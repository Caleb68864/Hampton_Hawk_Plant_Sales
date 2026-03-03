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
}
