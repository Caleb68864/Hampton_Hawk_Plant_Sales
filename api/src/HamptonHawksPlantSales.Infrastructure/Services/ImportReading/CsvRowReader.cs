using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using ValidationException = FluentValidation.ValidationException;

namespace HamptonHawksPlantSales.Infrastructure.Services.ImportReading;

/// <summary>
/// Reads a CSV stream. Skips any blank leading lines, trims header names, and
/// returns (headers, rows). Enforces non-blank and unique header names.
/// </summary>
public class CsvRowReader
{
    public (IReadOnlyList<string> Headers, List<Dictionary<string, string>> Rows) Read(Stream stream)
    {
        using var reader = new StreamReader(stream);
        var allText = reader.ReadToEnd();

        // Drop blank leading lines.
        var lines = allText.Split('\n');
        int firstNonBlank = 0;
        while (firstNonBlank < lines.Length && string.IsNullOrWhiteSpace(lines[firstNonBlank]))
        {
            firstNonBlank++;
        }

        if (firstNonBlank >= lines.Length)
        {
            throw new ValidationException("The uploaded CSV file is empty or contains no header row.");
        }

        var joined = string.Join('\n', lines.Skip(firstNonBlank));
        using var stringReader = new StringReader(joined);
        using var csv = new CsvReader(stringReader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HeaderValidated = null,
            MissingFieldFound = null,
            TrimOptions = TrimOptions.Trim
        });

        csv.Read();
        csv.ReadHeader();
        var rawHeaders = csv.HeaderRecord ?? Array.Empty<string>();
        var headers = rawHeaders.Select(h => (h ?? string.Empty).Trim()).ToList();

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < headers.Count; i++)
        {
            if (string.IsNullOrWhiteSpace(headers[i]))
            {
                throw new ValidationException($"Header row contains a blank column name at column {i + 1}. Provide a name for each header column and retry the import.");
            }
            if (!seen.Add(headers[i]))
            {
                throw new ValidationException($"Header row contains duplicate column name '{headers[i]}'. Rename duplicate headers so each column name is unique.");
            }
        }

        var rows = new List<Dictionary<string, string>>();
        while (csv.Read())
        {
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < headers.Count; i++)
            {
                dict[headers[i]] = csv.GetField(i) ?? string.Empty;
            }
            rows.Add(dict);
        }

        return (headers, rows);
    }
}
