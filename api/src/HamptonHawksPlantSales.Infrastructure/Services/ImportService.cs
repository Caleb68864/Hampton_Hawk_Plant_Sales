using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
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
        var rows = ReadRows(type, filename, fileStream);

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
                (imported, skippedCount, issues) = await orderHandler.HandleAsync(batch.Id, rows, options.ResolveDuplicateOrderNumbers);
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

    private static List<Dictionary<string, string>> ReadRows(ImportType type, string filename, Stream fileStream)
    {
        var ext = Path.GetExtension(filename).ToLowerInvariant();
        return ext switch
        {
            ".csv" => ReadCsv(fileStream),
            ".xlsx" => ReadXlsx(fileStream),
            ".pdf" when type == ImportType.Orders => ReadOrdersPdf(fileStream),
            ".pdf" => throw new ArgumentException("PDF import is supported for orders only."),
            _ => throw new ArgumentException($"Unsupported file type '{ext}'. Supported: .csv, .xlsx{(type == ImportType.Orders ? ", .pdf" : "")}")
        };
    }

    private static List<Dictionary<string, string>> ReadOrdersPdf(Stream stream)
    {
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);

        var text = ExtractPdfContentText(buffer.ToArray());
        var tokens = ExtractPdfTokens(text);

        var customer = FindValueAfterLabel(tokens, "Customer:");
        var seller = FindPrefixedValue(tokens, "Seller:");
        var orderDate = FindPrefixedValue(tokens, "Order Date:");
        var request = FindPrefixedValue(tokens, "Special Request:");
        var orderNumber = BuildOrderNumber(customer, orderDate, request);

        var rows = ExtractOrderLineRows(tokens);
        return rows
            .Where(r => r.qty > 0 && !string.IsNullOrWhiteSpace(r.sku))
            .Select(r => new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["OrderNumber"] = orderNumber,
                ["CustomerDisplayName"] = customer,
                ["SellerDisplayName"] = seller,
                ["OrderDate"] = orderDate,
                ["Notes"] = request,
                ["Sku"] = r.sku,
                ["QtyOrdered"] = r.qty.ToString(CultureInfo.InvariantCulture)
            })
            .ToList();
    }

    private static string ExtractPdfContentText(byte[] pdfBytes)
    {
        var text = new StringBuilder();
        var streamRegex = new Regex("stream\\r?\\n", RegexOptions.Compiled);
        var content = Encoding.Latin1.GetString(pdfBytes);
        foreach (Match match in streamRegex.Matches(content))
        {
            var start = match.Index + match.Length;
            var end = content.IndexOf("endstream", start, StringComparison.Ordinal);
            if (end < 0)
            {
                continue;
            }

            var raw = new byte[end - start];
            Array.Copy(pdfBytes, start, raw, 0, raw.Length);

            var decoded = TryInflate(raw);
            if (decoded == null)
            {
                continue;
            }

            text.AppendLine(decoded);
        }

        return text.ToString();
    }

    private static string? TryInflate(byte[] bytes)
    {
        try
        {
            using var ms = new MemoryStream(bytes);
            using var deflate = new ZLibStream(ms, CompressionMode.Decompress);
            using var reader = new StreamReader(deflate, Encoding.Latin1);
            return reader.ReadToEnd();
        }
        catch
        {
            var asText = Encoding.Latin1.GetString(bytes);
            return asText.Contains("Tj", StringComparison.Ordinal) ? asText : null;
        }
    }

    private static List<PdfToken> ExtractPdfTokens(string content)
    {
        var tokens = new List<PdfToken>();
        double x = 0;
        double y = 0;

        var tmRegex = new Regex(@"1\s+0\s+0\s+1\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm", RegexOptions.Compiled);
        var tjRegex = new Regex(@"\((?<text>(?:\\.|[^\\)])*)\)Tj", RegexOptions.Compiled);

        foreach (var line in content.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var tm = tmRegex.Match(line);
            if (tm.Success)
            {
                x = double.Parse(tm.Groups[1].Value, CultureInfo.InvariantCulture);
                y = double.Parse(tm.Groups[2].Value, CultureInfo.InvariantCulture);
                continue;
            }

            var tj = tjRegex.Match(line);
            if (!tj.Success)
            {
                continue;
            }

            var text = UnescapePdfString(tj.Groups["text"].Value).Trim();
            if (text.Length == 0)
            {
                continue;
            }

            tokens.Add(new PdfToken(x, y, text));
        }

        return tokens;
    }

    private static string UnescapePdfString(string value)
    {
        return value
            .Replace("\\(", "(")
            .Replace("\\)", ")")
            .Replace("\\\\", "\\");
    }

    private static string FindValueAfterLabel(List<PdfToken> tokens, string label)
    {
        var index = tokens.FindIndex(t => t.Text.Equals(label, StringComparison.OrdinalIgnoreCase));
        if (index < 0)
        {
            return string.Empty;
        }

        for (var i = index + 1; i < tokens.Count; i++)
        {
            var candidate = tokens[i].Text.Trim();
            if (candidate.Length == 0 || candidate.EndsWith(':'))
            {
                continue;
            }

            return candidate;
        }

        return string.Empty;
    }

    private static string FindPrefixedValue(List<PdfToken> tokens, string prefix)
    {
        var entry = tokens.FirstOrDefault(t => t.Text.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
        return entry?.Text[prefix.Length..].Trim() ?? string.Empty;
    }

    private static string BuildOrderNumber(string customer, string orderDate, string request)
    {
        var tidMatch = Regex.Match(request, @"TID:\s*([A-Za-z0-9\-_]+)");
        if (tidMatch.Success)
        {
            return $"PDF-{tidMatch.Groups[1].Value}";
        }

        var customerPart = Regex.Replace(customer, @"[^A-Za-z0-9]+", string.Empty);
        if (customerPart.Length > 12)
        {
            customerPart = customerPart[..12];
        }

        var datePart = DateTime.TryParse(orderDate, out var parsed)
            ? parsed.ToString("yyyyMMdd", CultureInfo.InvariantCulture)
            : DateTime.UtcNow.ToString("yyyyMMdd", CultureInfo.InvariantCulture);

        return $"PDF-{datePart}-{customerPart}";
    }

    private static List<(string sku, int qty)> ExtractOrderLineRows(List<PdfToken> tokens)
    {
        var byRow = tokens
            .GroupBy(t => Math.Round(t.Y, 0))
            .OrderByDescending(g => g.Key)
            .ToList();

        var rows = new List<(string sku, int qty)>();
        foreach (var row in byRow)
        {
            var cols = row.OrderBy(t => t.X).ToList();
            var hasHeader = cols.Any(c => c.Text.Equals("Num", StringComparison.OrdinalIgnoreCase)) &&
                            cols.Any(c => c.Text.Equals("Quantity", StringComparison.OrdinalIgnoreCase));
            if (hasHeader)
            {
                continue;
            }

            var sku = cols.Where(c => c.X < 130).Select(c => c.Text).FirstOrDefault(t => Regex.IsMatch(t, @"^\d+$")) ?? string.Empty;
            var name = cols.FirstOrDefault(c => c.X >= 130 && c.X < 350)?.Text ?? string.Empty;
            var qtyText = cols.FirstOrDefault(c => c.X >= 350 && c.X < 450)?.Text ?? string.Empty;

            if (string.IsNullOrWhiteSpace(sku) || !int.TryParse(qtyText, out var qty))
            {
                continue;
            }

            if (name.Contains("Handling Fee", StringComparison.OrdinalIgnoreCase) ||
                name.Contains("Total", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            rows.Add((sku, qty));
        }

        return rows;
    }

    private sealed record PdfToken(double X, double Y, string Text);

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
        try
        {
            using var workbook = new XLWorkbook(stream);
            if (workbook.Worksheets.Count == 0)
            {
                throw new ValidationException("The uploaded Excel file does not contain any worksheets. Add a worksheet with a header row and try again.");
            }

            var worksheet = workbook.Worksheets.First();

            var headerRow = worksheet.Row(1);
            var lastCol = worksheet.LastColumnUsed()?.ColumnNumber() ?? 0;
            if (lastCol == 0)
            {
                throw new ValidationException("The first worksheet is missing a header row. Add column headers in row 1 and try again.");
            }

            var headers = new List<string>();
            var seenHeaders = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int col = 1; col <= lastCol; col++)
            {
                var headerName = headerRow.Cell(col).GetString().Trim();
                if (string.IsNullOrWhiteSpace(headerName))
                {
                    throw new ValidationException($"Header row contains a blank column name at column {col}. Provide a name for each header column and retry the import.");
                }

                if (!seenHeaders.Add(headerName))
                {
                    throw new ValidationException($"Header row contains duplicate column name '{headerName}'. Rename duplicate headers so each column name is unique.");
                }

                headers.Add(headerName);
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
        catch (ValidationException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new ValidationException($"The uploaded Excel file is malformed or unreadable. Please re-save the file as a valid .xlsx workbook and try again. Details: {ex.Message}");
        }
    }
}
