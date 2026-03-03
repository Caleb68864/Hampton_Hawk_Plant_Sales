using System.Reflection;
using FluentAssertions;
using HamptonHawksPlantSales.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Tests.Services;

public class FulfillmentConcurrencyHandlingTests
{
    [Theory]
    [InlineData("could not serialize access due to read/write dependencies")]
    [InlineData("deadlock detected")]
    [InlineData("concurrent update")]
    public void IsRetryableConcurrencyException_ReturnsTrue_ForKnownMessages(string message)
    {
        var exception = new DbUpdateException("boom", new Exception(message));
        InvokeIsRetryableConcurrencyException(exception).Should().BeTrue();
    }

    [Fact]
    public void IsRetryableConcurrencyException_ReturnsFalse_ForUnknownMessage()
    {
        var exception = new DbUpdateException("boom", new Exception("connection reset by peer"));
        InvokeIsRetryableConcurrencyException(exception).Should().BeFalse();
    }

    private static bool InvokeIsRetryableConcurrencyException(DbUpdateException exception)
    {
        var method = typeof(FulfillmentService).GetMethod(
            "IsRetryableConcurrencyException",
            BindingFlags.NonPublic | BindingFlags.Static);

        method.Should().NotBeNull();

        return (bool)method!.Invoke(null, new object[] { exception })!;
    }
}
