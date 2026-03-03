using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace HamptonHawksPlantSales.Tests.Helpers;

public static class MockDbContextFactory
{
    public static AppDbContext Create(string? dbName = null)
    {
        dbName ??= Guid.NewGuid().ToString();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        var context = new AppDbContext(options);
        context.Database.EnsureCreated();
        return context;
    }
}
