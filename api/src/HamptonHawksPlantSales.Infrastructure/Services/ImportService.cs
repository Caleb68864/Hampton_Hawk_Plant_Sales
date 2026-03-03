using System.Globalization;
using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class ImportService : IImportService
{
    private readonly AppDbContext _db;

    public ImportService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ImportResultResponse> ImportAsync(ImportType type, string filename, Stream fileStream, ImportOptions? options = null)
    {
        options ??= new ImportOptions();
        var rows = ReadRows(filename, fileStream);

        var batch = new ImportBatch
        {
            Type = type,
            Filename = filename,
            TotalRows = rows.Count,
            ImportedCount = 0,
            SkippedCount = 0
        };
        if (!options.DryRun)
        {
            _db.ImportBatches.Add(batch);
            await _db.SaveChangesAsync();
        }

        int imported;
        int skippedCount;
        List<ImportIssue> issues;

        switch (type)
        {
            case ImportType.Plants:
                var plantHandler = new PlantImportHandler(_db);
                (imported, skippedCount, issues) = await plantHandler.HandleAsync(batch.Id, rows, options.UpsertPlantsBySku);
                break;
            case ImportType.Inventory:
                var invHandler = new InventoryImportHandler(_db);
                (imported, skippedCount, issues) = await invHandler.HandleAsync(batch.Id, rows);
                break;
            case ImportType.Orders:
                var orderHandler = new OrderImportHandler(_db);
                (imported, skippedCount, issues) = await orderHandler.HandleAsync(batch.Id, rows);
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(type));
        }

        if (!options.DryRun)
        {
            // Save issues
            if (issues.Count > 0)
            {
                _db.ImportIssues.AddRange(issues);
            }

            batch.ImportedCount = imported;
            batch.SkippedCount = skippedCount;
            await _db.SaveChangesAsync();
        }
        else
        {
            _db.ChangeTracker.Clear();
        }

        return new ImportResultResponse
        {
            BatchId = options.DryRun ? Guid.Empty : batch.Id,
            TotalRows = batch.TotalRows,
            ImportedCount = imported,
            SkippedCount = skippedCount,
            IssueCount = issues.Count,
            DryRun = options.DryRun
        };
    }

    public async Task<PagedResult<ImportBatchResponse>> GetBatchesAsync(PaginationParams paging)
    {
        var query = _db.ImportBatches
            .Where(b => b.DeletedAt == null)
            .OrderByDescending(b => b.CreatedAt);

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .Select(b => new ImportBatchResponse
            {
                Id = b.Id,
                Type = b.Type.ToString(),
                Filename = b.Filename,
                TotalRows = b.TotalRows,
                ImportedCount = b.ImportedCount,
                SkippedCount = b.SkippedCount,
                CreatedAt = b.CreatedAt
            })
            .ToListAsync();

        return new PagedResult<ImportBatchResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    public async Task<PagedResult<ImportIssueResponse>> GetBatchIssuesAsync(Guid batchId, string? search, PaginationParams paging)
    {
        var query = _db.ImportIssues
            .Where(i => i.ImportBatchId == batchId && i.DeletedAt == null);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(i =>
                (i.Sku != null && i.Sku.ToLower().Contains(term)) ||
                (i.Barcode != null && i.Barcode.ToLower().Contains(term)) ||
                i.IssueType.ToLower().Contains(term) ||
                i.Message.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(i => i.RowNumber)
            .Skip((paging.Page - 1) * paging.PageSize)
            .Take(paging.PageSize)
            .Select(i => new ImportIssueResponse
            {
                Id = i.Id,
                RowNumber = i.RowNumber,
                IssueType = i.IssueType,
                Barcode = i.Barcode,
                Sku = i.Sku,
                Message = i.Message,
                RawData = i.RawData
            })
            .ToListAsync();

        return new PagedResult<ImportIssueResponse>
        {
            Items = items,
            TotalCount = totalCount,
            Page = paging.Page,
            PageSize = paging.PageSize
        };
    }

    private static List<Dictionary<string, string>> ReadRows(string filename, Stream fileStream)
    {
        var ext = Path.GetExtension(filename).ToLowerInvariant();
        return ext switch
        {
            ".csv" => ReadCsv(fileStream),
            ".xlsx" => ReadXlsx(fileStream),
            _ => throw new ArgumentException($"Unsupported file type '{ext}'. Supported: .csv, .xlsx")
        };
    }

    private static List<Dictionary<string, string>> ReadCsv(Stream stream)
    {
        var rows = new List<Dictionary<string, string>>();
        using var reader = new StreamReader(stream);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HeaderValidated = null,
            MissingFieldFound = null,
            TrimOptions = TrimOptions.Trim
        });

        csv.Read();
        csv.ReadHeader();
        var headers = csv.HeaderRecord ?? Array.Empty<string>();

        while (csv.Read())
        {
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var header in headers)
            {
                dict[header] = csv.GetField(header) ?? "";
            }
            rows.Add(dict);
        }

        return rows;
    }

    private static List<Dictionary<string, string>> ReadXlsx(Stream stream)
    {
        var rows = new List<Dictionary<string, string>>();
        using var workbook = new XLWorkbook(stream);
        var worksheet = workbook.Worksheets.First();

        var headerRow = worksheet.Row(1);
        var headers = new List<string>();
        var lastCol = worksheet.LastColumnUsed()?.ColumnNumber() ?? 0;
        for (int col = 1; col <= lastCol; col++)
        {
            headers.Add(headerRow.Cell(col).GetString().Trim());
        }

        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 0;
        for (int rowNum = 2; rowNum <= lastRow; rowNum++)
        {
            var row = worksheet.Row(rowNum);
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            bool hasData = false;
            for (int col = 0; col < headers.Count; col++)
            {
                var val = row.Cell(col + 1).GetString().Trim();
                dict[headers[col]] = val;
                if (!string.IsNullOrWhiteSpace(val))
                    hasData = true;
            }
            if (hasData)
                rows.Add(dict);
        }

        return rows;
    }
}
