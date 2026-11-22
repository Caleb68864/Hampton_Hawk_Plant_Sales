using FluentValidation;

namespace HamptonHawksPlantSales.Core.Validators;

/// <summary>
/// The one rule for an order line's ordered quantity, shared by every route that
/// sets it. Only POST /orders validated lines; the walk-up and single-line routes
/// saved 0 (an empty line) and let a negative through the availability check
/// (-5 &gt; available is false) to hit the fulfilled &lt;= ordered check constraint as
/// a 500. The ceiling keeps sums of quantities far from int overflow.
/// </summary>
public static class LineQuantity
{
    public const int Max = 10_000;

    public static void EnsureValid(int qtyOrdered)
    {
        if (qtyOrdered <= 0)
            throw new ValidationException("Quantity ordered must be greater than zero.");
        if (qtyOrdered > Max)
            throw new ValidationException($"Quantity ordered cannot be more than {Max:N0}.");
    }
}
