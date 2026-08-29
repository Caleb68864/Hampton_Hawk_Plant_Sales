namespace HamptonHawksPlantSales.Core.DTOs;

public class PaginationParams
{
    private int _page = 1;
    private int _pageSize = 25;

    public int Page
    {
        get => _page;
        set => _page = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value < 1 ? 25 : value > 200 ? 200 : value;
    }

    /// <summary>
    /// Optional sort column. Each list endpoint whitelists the keys it understands
    /// and falls back to its default order for anything else.
    /// </summary>
    public string? SortBy { get; set; }

    /// <summary>
    /// "asc" or "desc" (case-insensitive). Anything else is treated as "desc".
    /// </summary>
    public string? SortDir { get; set; }

    public bool SortDescending =>
        !string.Equals(SortDir, "asc", StringComparison.OrdinalIgnoreCase);
}
