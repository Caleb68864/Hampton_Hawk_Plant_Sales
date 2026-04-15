using System.IO.Compression;
using System.Xml.Linq;
using ClosedXML.Excel;
using ValidationException = FluentValidation.ValidationException;

namespace HamptonHawksPlantSales.Infrastructure.Services.ImportReading;

/// <summary>
/// Reads the first worksheet of an xlsx file. Scans top-down for the first non-blank
/// row and treats it as the header row (tolerates blank leading rows). Trims every
/// header name. Throws <see cref="ValidationException"/> for missing worksheets, blank
/// header cells inside a detected header row, and duplicate header names.
/// </summary>
public class ExcelRowReader
{
    public (IReadOnlyList<string> Headers, List<Dictionary<string, string>> Rows) Read(Stream stream)
    {
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        buffer.Position = 0;

        try
        {
            using var workbook = new XLWorkbook(buffer);
            if (workbook.Worksheets.Count == 0)
            {
                throw new ValidationException("The uploaded Excel file does not contain any worksheets. Add a worksheet with a header row and try again.");
            }

            var worksheet = workbook.Worksheets.First();
            var lastCol = worksheet.LastColumnUsed()?.ColumnNumber() ?? 0;
            var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 0;

            if (lastCol == 0 || lastRow == 0)
            {
                throw new ValidationException("The first worksheet is missing a header row. Add column headers in row 1 and try again.");
            }

            // Scan for the first non-blank row — treat as header row.
            int headerRowNum = 0;
            for (int r = 1; r <= lastRow; r++)
            {
                var row = worksheet.Row(r);
                for (int c = 1; c <= lastCol; c++)
                {
                    if (!string.IsNullOrWhiteSpace(row.Cell(c).GetString()))
                    {
                        headerRowNum = r;
                        break;
                    }
                }
                if (headerRowNum > 0) break;
            }

            if (headerRowNum == 0)
            {
                throw new ValidationException("The first worksheet is missing a header row. Add column headers in row 1 and try again.");
            }

            var headerRow = worksheet.Row(headerRowNum);

            // Determine the true last populated column in the header row.
            int headerLastCol = lastCol;
            while (headerLastCol > 0 && string.IsNullOrWhiteSpace(headerRow.Cell(headerLastCol).GetString()))
            {
                headerLastCol--;
            }

            if (headerLastCol == 0)
            {
                throw new ValidationException("The first worksheet is missing a header row. Add column headers in row 1 and try again.");
            }

            var headers = new List<string>();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int c = 1; c <= headerLastCol; c++)
            {
                var headerName = headerRow.Cell(c).GetString().Trim();
                if (string.IsNullOrWhiteSpace(headerName))
                {
                    throw new ValidationException($"Header row contains a blank column name at column {c}. Provide a name for each header column and retry the import.");
                }
                if (!seen.Add(headerName))
                {
                    throw new ValidationException($"Header row contains duplicate column name '{headerName}'. Rename duplicate headers so each column name is unique.");
                }
                headers.Add(headerName);
            }

            var rows = new List<Dictionary<string, string>>();
            for (int r = headerRowNum + 1; r <= lastRow; r++)
            {
                var row = worksheet.Row(r);
                var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                bool hasData = false;
                for (int c = 0; c < headers.Count; c++)
                {
                    var val = row.Cell(c + 1).GetString().Trim();
                    dict[headers[c]] = val;
                    if (!string.IsNullOrWhiteSpace(val))
                    {
                        hasData = true;
                    }
                }
                if (hasData)
                {
                    rows.Add(dict);
                }
            }

            return (headers, rows);
        }
        catch (ValidationException)
        {
            throw;
        }
        catch (Exception ex)
        {
            if (TryGetWorksheetHeaderError(buffer, out var headerError))
            {
                throw new ValidationException(headerError);
            }
            throw new ValidationException($"The uploaded Excel file is malformed or unreadable. Please re-save the file as a valid .xlsx workbook and try again. Details: {ex.Message}");
        }
    }

    // ── Fallback: raw OOXML inspection used when ClosedXML fails to open the workbook ──

    private static bool TryGetWorksheetHeaderError(MemoryStream workbookStream, out string errorMessage)
    {
        errorMessage = string.Empty;
        try
        {
            workbookStream.Position = 0;
            using var archive = new ZipArchive(workbookStream, ZipArchiveMode.Read, leaveOpen: true);

            var worksheetEntry = archive.Entries
                .Where(entry => entry.FullName.StartsWith("xl/worksheets/", StringComparison.OrdinalIgnoreCase) &&
                                entry.FullName.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
                .OrderBy(entry => entry.FullName, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();

            if (worksheetEntry == null)
            {
                return false;
            }

            var sharedStrings = ReadSharedStrings(archive);
            using var worksheetEntryStream = worksheetEntry.Open();
            var sheetDocument = XDocument.Load(worksheetEntryStream);
            XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

            var allCells = sheetDocument.Descendants(ns + "c").ToList();
            var lastCol = allCells
                .Select(cell => GetColumnIndex((string?)cell.Attribute("r")))
                .DefaultIfEmpty(0)
                .Max();

            if (lastCol == 0)
            {
                return false;
            }

            // Find first non-blank row.
            XElement? headerRow = null;
            foreach (var row in sheetDocument.Descendants(ns + "row").OrderBy(r => (int?)r.Attribute("r") ?? 0))
            {
                var hasAnyValue = row.Elements(ns + "c").Any(cell =>
                    !string.IsNullOrWhiteSpace(GetCellValue(cell, sharedStrings, ns)));
                if (hasAnyValue)
                {
                    headerRow = row;
                    break;
                }
            }

            if (headerRow == null)
            {
                return false;
            }

            var headersByColumn = new Dictionary<int, string>();
            foreach (var cell in headerRow.Elements(ns + "c"))
            {
                var columnIndex = GetColumnIndex((string?)cell.Attribute("r"));
                if (columnIndex == 0) continue;
                headersByColumn[columnIndex] = GetCellValue(cell, sharedStrings, ns).Trim();
            }

            int headerLastCol = headersByColumn.Keys.DefaultIfEmpty(0).Max();
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (var col = 1; col <= headerLastCol; col++)
            {
                headersByColumn.TryGetValue(col, out var headerName);
                if (string.IsNullOrWhiteSpace(headerName))
                {
                    errorMessage = $"Header row contains a blank column name at column {col}. Provide a name for each header column and retry the import.";
                    return true;
                }
                if (!seen.Add(headerName))
                {
                    errorMessage = $"Header row contains duplicate column name '{headerName}'. Rename duplicate headers so each column name is unique.";
                    return true;
                }
            }

            return false;
        }
        catch
        {
            return false;
        }
        finally
        {
            workbookStream.Position = 0;
        }
    }

    private static Dictionary<int, string> ReadSharedStrings(ZipArchive archive)
    {
        var sharedStrings = new Dictionary<int, string>();
        var sharedStringsEntry = archive.GetEntry("xl/sharedStrings.xml");
        if (sharedStringsEntry == null)
        {
            return sharedStrings;
        }

        using var stream = sharedStringsEntry.Open();
        var document = XDocument.Load(stream);
        XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

        var index = 0;
        foreach (var si in document.Descendants(ns + "si"))
        {
            sharedStrings[index++] = string.Concat(si.Descendants(ns + "t").Select(t => t.Value));
        }

        return sharedStrings;
    }

    private static string GetCellValue(XElement cell, IReadOnlyDictionary<int, string> sharedStrings, XNamespace ns)
    {
        var cellType = (string?)cell.Attribute("t");
        return cellType switch
        {
            "inlineStr" => string.Concat(cell.Descendants(ns + "t").Select(text => text.Value)),
            "s" => int.TryParse(cell.Element(ns + "v")?.Value, out var index) && sharedStrings.TryGetValue(index, out var sharedValue)
                ? sharedValue
                : string.Empty,
            _ => cell.Element(ns + "v")?.Value ?? string.Concat(cell.Descendants(ns + "t").Select(text => text.Value))
        };
    }

    private static int GetColumnIndex(string? cellReference)
    {
        if (string.IsNullOrWhiteSpace(cellReference)) return 0;
        var columnIndex = 0;
        foreach (var ch in cellReference)
        {
            if (!char.IsLetter(ch)) break;
            columnIndex = (columnIndex * 26) + (char.ToUpperInvariant(ch) - 'A' + 1);
        }
        return columnIndex;
    }
}
