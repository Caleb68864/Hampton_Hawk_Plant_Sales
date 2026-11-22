using System.Security.Claims;
using FluentAssertions;
using HamptonHawksPlantSales.Api.Controllers;
using HamptonHawksPlantSales.Core.DTOs.Reports;
using HamptonHawksPlantSales.Core.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Moq;

namespace HamptonHawksPlantSales.Tests.Reports;

public class LiveSaleKpiAccessTests
{
    private static ReportsController Controller(string? setting, bool signedIn)
    {
        var service = new Mock<IReportService>();
        service.Setup(s => s.GetLiveSaleKpiAsync(It.IsAny<string?>())).ReturnsAsync(new LiveSaleKpiResponse());
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(setting == null
                ? new Dictionary<string, string?>()
                : new Dictionary<string, string?> { [ReportsController.LiveSaleKpiAnonymousSetting] = setting })
            .Build();
        var identity = signedIn ? new ClaimsIdentity(new[] { new Claim(ClaimTypes.Name, "admin") }, "cookie") : new ClaimsIdentity();
        return new ReportsController(service.Object, config)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) } }
        };
    }

    [Theory]
    [InlineData(null)]    // default: the projector keeps working without a login
    [InlineData("true")]
    public async Task Anonymous_IsAllowedByDefault(string? setting)
    {
        (await Controller(setting, signedIn: false).GetLiveSaleKpi()).Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Anonymous_IsRefused_WhenTheSettingIsOff_ButSignedInStillWorks()
    {
        (await Controller("false", signedIn: false).GetLiveSaleKpi()).Should().BeOfType<UnauthorizedObjectResult>();
        (await Controller("false", signedIn: true).GetLiveSaleKpi()).Should().BeOfType<OkObjectResult>();
    }
}
