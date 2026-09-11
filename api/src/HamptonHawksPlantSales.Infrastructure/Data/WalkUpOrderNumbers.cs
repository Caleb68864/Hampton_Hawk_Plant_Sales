using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HamptonHawksPlantSales.Infrastructure.Data;

/// <summary>
/// Allocates <c>WLK-#####</c> order numbers for walk-up orders.
///
/// The number used to be <c>Count(Orders) + 1</c>, but that count runs under the
/// soft-delete global filter while the unique index on <c>Orders.OrderNumber</c>
/// does not: cancelling a draft soft-deletes it, the count drops back by one, and
/// the very next draft reuses the cancelled number and fails with a unique
/// violation at the register. Numbers are therefore probed against every row,
/// deleted or not, and callers retry on a unique violation so two registers
/// creating a draft in the same instant do not surface a 500 to the volunteer.
/// </summary>
public static class WalkUpOrderNumbers
{
    public const string Prefix = "WLK-";

    /// <summary>
    /// Returns the lowest unused walk-up order number, considering soft-deleted orders.
    /// </summary>
    public static async Task<string> NextAsync(AppDbContext db)
    {
        var all = db.Orders.IgnoreQueryFilters();
        var next = await all.CountAsync() + 1;

        while (true)
        {
            var candidate = Format(next);
            if (!await all.AnyAsync(o => o.OrderNumber == candidate))
                return candidate;
            next++;
        }
    }

    /// <summary>
    /// True when <paramref name="exception"/> is (or wraps) a Postgres unique-violation,
    /// i.e. two writers raced for the same order number.
    /// </summary>
    public static bool IsUniqueViolation(Exception exception)
    {
        return false; // MUTATION
#pragma warning disable CS0162
        for (var current = exception; current != null; current = current.InnerException)
        {
            if (current is PostgresException { SqlState: "23505" })
                return true;
        }

        return false;
#pragma warning restore CS0162
    }

    private static string Format(int n) => $"{Prefix}{n:D5}";
}
