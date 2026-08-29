using FluentAssertions;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HamptonHawksPlantSales.Tests.Services;

/// <summary>
/// The fulfillment scan path retries through <see cref="WalkUpRowLocks.ExecuteWithRetryAsync"/>,
/// so the classifier it relies on must recognise every shape the conflict arrives in:
/// a DbUpdateException from SaveChanges, or a raw PostgresException thrown by the
/// SELECT ... FOR UPDATE that precedes it.
/// </summary>
public class FulfillmentConcurrencyHandlingTests
{
    [Theory]
    [InlineData("could not serialize access due to read/write dependencies")]
    [InlineData("deadlock detected")]
    [InlineData("concurrent update")]
    public void IsRetryableConcurrencyFailure_ReturnsTrue_ForKnownMessages(string message)
    {
        var exception = new DbUpdateException("boom", new Exception(message));
        WalkUpRowLocks.IsRetryableConcurrencyFailure(exception).Should().BeTrue();
    }

    [Theory]
    [InlineData("40001")]
    [InlineData("40P01")]
    public void IsRetryableConcurrencyFailure_ReturnsTrue_ForRawPostgresSqlState(string sqlState)
    {
        // Under Serializable the conflict fires at the raw FOR UPDATE, not at SaveChanges,
        // so it is not wrapped in a DbUpdateException at all.
        var exception = new PostgresException("transient", "ERROR", "ERROR", sqlState);
        WalkUpRowLocks.IsRetryableConcurrencyFailure(exception).Should().BeTrue();
    }

    [Fact]
    public void IsRetryableConcurrencyFailure_ReturnsFalse_ForUnknownMessage()
    {
        var exception = new DbUpdateException("boom", new Exception("connection reset by peer"));
        WalkUpRowLocks.IsRetryableConcurrencyFailure(exception).Should().BeFalse();
    }

    [Fact]
    public void IsRetryableConcurrencyFailure_ReturnsFalse_ForNonTransientPostgresError()
    {
        var exception = new PostgresException("duplicate key", "ERROR", "ERROR", "23505");
        WalkUpRowLocks.IsRetryableConcurrencyFailure(exception).Should().BeFalse();
    }
}
