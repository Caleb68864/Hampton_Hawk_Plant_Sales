namespace HamptonHawksPlantSales.PostgresTests.Infrastructure;

/// <summary>
/// A test that runs against a real PostgreSQL container. Skipped unless
/// <c>HH_POSTGRES_TESTS=1</c>, because Testcontainers needs a usable Docker daemon and
/// the solution's plain <c>dotnet test</c> has to keep working without one.
///
/// The skip is only safe because CI checks it: the "API against real Postgres" job sets
/// the variable and fails if the results report a single skipped test.
/// </summary>
public sealed class PostgresFactAttribute : FactAttribute
{
    public const string EnableVariable = "HH_POSTGRES_TESTS";

    public PostgresFactAttribute()
    {
        if (!IsEnabled)
        {
            Skip = $"Needs Docker. Set {EnableVariable}=1 to run against a PostgreSQL container " +
                   "(CI does this in the 'API against real Postgres' job).";
        }
    }

    public static bool IsEnabled =>
        Environment.GetEnvironmentVariable(EnableVariable) is "1" or "true" or "TRUE";
}
