using HamptonHawksPlantSales.Api.Controllers;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace HamptonHawksPlantSales.Tests.Services;

public class AdminActionsControllerTests
{
    [Fact]
    public async Task GetAll_ForwardsFiltersAndReturnsEnvelope()
    {
        var orderId = Guid.NewGuid();
        var expected = new List<AdminActionResponse>
        {
            new()
            {
                Id = Guid.NewGuid(),
                ActionType = "ForceComplete",
                EntityType = "Order",
                EntityId = orderId,
                Reason = "test",
                Message = "msg",
                CreatedAt = DateTimeOffset.UtcNow
            }
        };

        var adminMock = new Mock<IAdminService>();
        adminMock.Setup(a => a.GetActionsAsync(orderId, "Order", "ForceComplete"))
            .ReturnsAsync(expected);

        var controller = new AdminActionsController(adminMock.Object);

        var result = await controller.GetAll(orderId, "Order", "ForceComplete");

        var ok = Assert.IsType<OkObjectResult>(result);
        var envelope = Assert.IsType<ApiResponse<List<AdminActionResponse>>>(ok.Value);
        Assert.True(envelope.Success);
        Assert.Single(envelope.Data!);
        Assert.Equal(orderId, envelope.Data![0].EntityId);

        adminMock.Verify(a => a.GetActionsAsync(orderId, "Order", "ForceComplete"), Times.Once);
    }
}
