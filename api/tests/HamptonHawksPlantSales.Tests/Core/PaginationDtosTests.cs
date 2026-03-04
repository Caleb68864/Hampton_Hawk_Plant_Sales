using HamptonHawksPlantSales.Core.DTOs;

namespace HamptonHawksPlantSales.Tests.Core;

public class PaginationDtosTests
{
    [Fact]
    public void PaginationParams_PageBelowOne_ClampsToOne()
    {
        var pagination = new PaginationParams { Page = -5 };

        Assert.Equal(1, pagination.Page);
    }

    [Fact]
    public void PaginationParams_PageSizeBelowOne_DefaultsTo25()
    {
        var pagination = new PaginationParams { PageSize = 0 };

        Assert.Equal(25, pagination.PageSize);
    }

    [Fact]
    public void PaginationParams_PageSizeAboveMax_ClampsTo200()
    {
        var pagination = new PaginationParams { PageSize = 999 };

        Assert.Equal(200, pagination.PageSize);
    }

    [Fact]
    public void PagedResult_TotalPages_UsesCeilingDivision()
    {
        var result = new PagedResult<string>
        {
            TotalCount = 51,
            PageSize = 25,
            Items = ["a", "b"]
        };

        Assert.Equal(3, result.TotalPages);
    }

    [Fact]
    public void PagedResult_TotalPages_WithZeroPageSize_ReturnsZero()
    {
        var result = new PagedResult<int>
        {
            TotalCount = 50,
            PageSize = 0
        };

        Assert.Equal(0, result.TotalPages);
    }
}
