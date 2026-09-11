namespace HamptonHawksPlantSales.Infrastructure.Data;

/// <summary>
/// One definition of a pick-list barcode, for the two places that write them and
/// the one place that looks them up.
///
/// The stored form is an uppercase prefix followed by a lowercase hex body --
/// <c>PLB-3f9a2c1d</c>. Both writers produce it: <see cref="New"/>, and the
/// <c>20260426162224_AddPicklistBarcodesAndScanSessions</c> backfill, which uses
/// Postgres <c>md5()</c> (lowercase).
///
/// The pickup station does not send that form. <c>normalizeOrderLookupValue</c>
/// in <c>web/src/utils/orderLookup.ts</c> ends in <c>.toUpperCase()</c>, so the
/// wire value is <c>PLB-3F9A2C1D</c>, and the lookup compares it with <c>==</c>
/// against a Postgres <c>text</c> column -- case-sensitive. Every scan missed.
/// A hand-typed or lowercasing-wedge scan misses the other way.
///
/// So reads go through <see cref="Normalize"/> before comparison, and
/// <see cref="New"/> is defined in terms of it. The two cannot drift: whatever
/// <see cref="Normalize"/> considers canonical is what gets written.
///
/// Normalising the scan rather than the column keeps the comparison an equality
/// against the stored value, so the unique filtered index on
/// <c>PicklistBarcode</c> is still used. <c>lower(column) = ...</c> would not be.
/// </summary>
public static class PicklistBarcodes
{
    public const string BuyerPrefix = "PLB-";
    public const string StudentPrefix = "PLS-";

    private static readonly string[] KnownPrefixes = [BuyerPrefix, StudentPrefix];

    /// <summary>
    /// Canonicalises a scanned or typed barcode to the stored form: surrounding
    /// whitespace removed, a recognised prefix forced to its canonical casing,
    /// and the body lowercased.
    ///
    /// A value with no recognised prefix is returned trimmed but otherwise
    /// untouched, so callers can still tell "unknown prefix" from "no match".
    /// </summary>
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var trimmed = value.Trim();

        foreach (var prefix in KnownPrefixes)
        {
            if (trimmed.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return prefix + trimmed[prefix.Length..].ToLowerInvariant();
        }

        return trimmed;
    }

    /// <summary>
    /// A fresh barcode in the stored form: prefix plus 8 hex characters, the
    /// same shape the AddPicklistBarcodes migration backfilled.
    /// </summary>
    public static string New(string prefix) =>
        Normalize(prefix + Convert.ToHexString(Guid.NewGuid().ToByteArray(), 0, 4));

    /// <summary>True when <paramref name="normalized"/> is a buyer barcode.</summary>
    public static bool IsBuyer(string normalized) =>
        normalized.StartsWith(BuyerPrefix, StringComparison.Ordinal);

    /// <summary>True when <paramref name="normalized"/> is a student barcode.</summary>
    public static bool IsStudent(string normalized) =>
        normalized.StartsWith(StudentPrefix, StringComparison.Ordinal);
}
