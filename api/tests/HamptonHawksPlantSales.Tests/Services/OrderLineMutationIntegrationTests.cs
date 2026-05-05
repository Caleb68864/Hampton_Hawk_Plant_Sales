using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Tests.Helpers;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HamptonHawksPlantSales.Tests.Services;

public class OrderLineMutationIntegrationTests
{
    [Fact]
    public async Task UpdateLine_InvalidQtyOrdered_Returns400WithStructuredErrorPayload()
    {
        await using var factory = new ApiWebApplicationFactory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Test");

        var (orderId, lineId) = await SeedOrderWithLineAsync(factory.Services, qtyOrdered: 3, qtyFulfilled: 1);

        var response = await client.PutAsJsonAsync($"/api/orders/{orderId}/lines/{lineId}", new UpdateOrderLineRequest
        {
            QtyOrdered = 0
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var envelope = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.NotNull(envelope);
        Assert.False(envelope!.Success);
        Assert.Null(envelope.Data);
        Assert.Contains("QtyOrdered must be greater than 0.", envelope.Errors);
    }

    [Fact]
    public async Task DeleteLine_WithPartialFulfillment_Returns400WithStructuredErrorPayload()
    {
        await using var factory = new ApiWebApplicationFactory();
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Test");

        var (orderId, lineId) = await SeedOrderWithLineAsync(factory.Services, qtyOrdered: 3, qtyFulfilled: 1);

        var response = await client.DeleteAsync($"/api/orders/{orderId}/lines/{lineId}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var envelope = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.NotNull(envelope);
        Assert.False(envelope!.Success);
        Assert.Null(envelope.Data);
        Assert.Contains("Cannot delete an order line that has been partially fulfilled.", envelope.Errors);
    }

    private static async Task<(Guid orderId, Guid lineId)> SeedOrderWithLineAsync(IServiceProvider services, int qtyOrdered, int qtyFulfilled)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var customer = TestDataBuilder.CreateCustomer();
        var plant = TestDataBuilder.CreatePlant();
        var order = TestDataBuilder.CreateOrder(customer.Id);
        var line = TestDataBuilder.CreateOrderLine(order.Id, plant.Id, qtyOrdered: qtyOrdered, qtyFulfilled: qtyFulfilled);

        db.Customers.Add(customer);
        db.PlantCatalogs.Add(plant);
        db.Orders.Add(order);
        db.OrderLines.Add(line);
        await db.SaveChangesAsync();

        return (order.Id, line.Id);
    }

    private sealed class ApiWebApplicationFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:Default", "Host=localhost;Database=unused;Username=unused;Password=unused");

            builder.ConfigureServices(services =>
            {
                // Remove ALL EF Core and Npgsql services to avoid dual-provider conflict
                var efDescriptors = services
                    .Where(d => d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                             || d.ServiceType == typeof(DbContextOptions)
                             || d.ServiceType == typeof(AppDbContext)
                             || (d.ServiceType.FullName?.Contains("EntityFrameworkCore") == true)
                             || (d.ServiceType.FullName?.Contains("Npgsql") == true))
                    .ToList();

                foreach (var d in efDescriptors)
                    services.Remove(d);

                // Use a fixed name so seed and request scopes share the same DB
                var dbName = $"tests-db-{Guid.NewGuid()}";
                services.AddDbContext<AppDbContext>(options =>
                    options.UseInMemoryDatabase(dbName));

                services.AddAuthentication("Test")
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", _ => { });
            });
        }
    }

    private sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
            : base(options, logger, encoder) { }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.ContainsKey("Authorization"))
                return Task.FromResult(AuthenticateResult.NoResult());

            var claims = new[]
            {
                new Claim(ClaimTypes.Name, "test-admin"),
                new Claim(ClaimTypes.Role, "Admin"),
            };
            var identity = new ClaimsIdentity(claims, "Test");
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, "Test");
            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }
}
