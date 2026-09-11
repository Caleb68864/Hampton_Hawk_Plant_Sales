using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;
using Testcontainers.PostgreSql;

namespace HamptonHawksPlantSales.PostgresTests.Infrastructure;

[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "Postgres";
}

/// <summary>
/// One PostgreSQL container for the whole run. The schema comes from the app's own
/// migrations -- the same <c>MigrateAsync</c> the API runs at startup -- applied once to
/// a template database. Each test then gets a fresh database cloned from that template,
/// so tests cannot see each other's rows and the order they run in does not matter.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    // Same major version as docker-compose.yml. Row-lock and SSI behaviour is what these
    // tests are about, so do not let this drift from what the sale actually runs on.
    private const string Image = "postgres:16";
    private const string TemplateDatabase = "hh_template";

    private PostgreSqlContainer? _container;

    public string ServerVersion { get; private set; } = "(not started)";

    public async Task InitializeAsync()
    {
        // xUnit builds collection fixtures even when every test in the collection is
        // skipped. Without Docker there is nothing to start, and trying would fail the run.
        if (!PostgresFactAttribute.IsEnabled) return;

        _container = new PostgreSqlBuilder(Image)
            .WithDatabase(TemplateDatabase)
            .WithUsername("plantapp")
            .WithPassword("plantapp")
            .Build();

        await _container.StartAsync();

        await using (var db = CreateContext(_container.GetConnectionString()))
        {
            await db.Database.MigrateAsync();
        }

        // CREATE DATABASE ... TEMPLATE refuses while anything is connected to the template.
        NpgsqlConnection.ClearAllPools();

        await using var conn = new NpgsqlConnection(ConnectionStringFor("postgres"));
        await conn.OpenAsync();
        ServerVersion = conn.PostgreSqlVersion.ToString();
    }

    public async Task DisposeAsync()
    {
        if (_container != null) await _container.DisposeAsync();
    }

    /// <summary>Creates an empty, fully migrated database for one test.</summary>
    public async Task<PgTestDb> CreateDatabaseAsync()
    {
        if (_container == null)
            throw new InvalidOperationException("The PostgreSQL container is not running. Is HH_POSTGRES_TESTS=1 set?");

        var name = "hh_" + Guid.NewGuid().ToString("N")[..16];

        await using (var conn = new NpgsqlConnection(ConnectionStringFor("postgres")))
        {
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{name}\" TEMPLATE \"{TemplateDatabase}\"", conn);
            await cmd.ExecuteNonQueryAsync();
        }

        return new PgTestDb(ConnectionStringFor(name));
    }

    private string ConnectionStringFor(string database)
    {
        var builder = new NpgsqlConnectionStringBuilder(_container!.GetConnectionString())
        {
            Database = database,
            IncludeErrorDetail = true
        };
        return builder.ConnectionString;
    }

    internal static AppDbContext CreateContext(string connectionString, params IInterceptor[] interceptors)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString)
            .AddInterceptors(interceptors)
            .Options;

        return new AppDbContext(options);
    }
}
