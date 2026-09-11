using System.Text;
using FluentAssertions;
using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Services;

public class ImportBatchAtomicityTests
{
    private static MemoryStream Csv(string text) => new(Encoding.UTF8.GetBytes(text));

    private static async Task<List<ImportIssue>> IssuesFor(ImportService service, Guid batchId)
    {
        var page = await service.GetBatchIssuesAsync(batchId, null, new PaginationParams { Page = 1, PageSize = 100 });
        return page.Items.Select(i => new ImportIssue { IssueType = i.IssueType, RowNumber = i.RowNumber }).ToList();
    }

    // ── I4: a handler exception must not leave an orphan batch ──

    [Fact]
    public async Task OrderImport_WhenHandlerThrows_LeavesNoBatchBehind()
    {
        using var db = MockDbContextFactory.Create();
        db.PlantCatalogs.Add(TestDataBuilder.CreatePlant(sku: "SKU-1", barcode: "BC-1"));
        db.Orders.Add(new Order
        {
            Customer = new Customer { DisplayName = "Existing", PickupCode = "EX1" },
            OrderNumber = "DUP"
        });
        await db.SaveChangesAsync();

        var service = new ImportService(db);
        var act = () => service.ImportAsync(ImportType.Orders, "orders.csv",
            Csv("OrderNumber,CustomerDisplayName,Sku,QtyOrdered\nDUP,Alex,SKU-1,1\n"));

        await act.Should().ThrowAsync<ValidationException>();
        db.ChangeTracker.Clear();
        (await db.ImportBatches.CountAsync()).Should().Be(0);
    }
}
