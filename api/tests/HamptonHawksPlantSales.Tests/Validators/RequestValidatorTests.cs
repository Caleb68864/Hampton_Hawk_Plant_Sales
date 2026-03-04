using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Validators;

namespace HamptonHawksPlantSales.Tests.Validators;

public class RequestValidatorTests
{
    [Fact]
    public void CreateCustomerValidator_RequiresDisplayName()
    {
        var validator = new CreateCustomerValidator();

        var result = validator.Validate(new CreateCustomerRequest { DisplayName = string.Empty });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Display name is required.");
    }

    [Fact]
    public void CreateOrderValidator_RequiresCustomerId()
    {
        var validator = new CreateOrderValidator();

        var result = validator.Validate(new CreateOrderRequest { CustomerId = Guid.Empty });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Customer is required.");
    }

    [Fact]
    public void CreateSellerValidator_RequiresDisplayName()
    {
        var validator = new CreateSellerValidator();

        var result = validator.Validate(new CreateSellerRequest { DisplayName = string.Empty });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Display name is required.");
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(10)]
    public void CreatePlantValidator_AcceptsNullOrNonNegativePrice(decimal? price)
    {
        var validator = new CreatePlantValidator();

        var result = validator.Validate(new CreatePlantRequest
        {
            Sku = "SKU-1",
            Barcode = "BC-1",
            Name = "Plant",
            Price = price
        });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreatePlantValidator_RejectsNegativePrice()
    {
        var validator = new CreatePlantValidator();

        var result = validator.Validate(new CreatePlantRequest
        {
            Sku = "SKU-1",
            Barcode = "BC-1",
            Name = "Plant",
            Price = -1m
        });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Price must be non-negative.");
    }

    [Fact]
    public void UpdatePlantValidator_RequiresSkuBarcodeAndName()
    {
        var validator = new UpdatePlantValidator();

        var result = validator.Validate(new UpdatePlantRequest());

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage == "SKU is required.");
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Barcode is required.");
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Name is required.");
    }

    [Fact]
    public void UpdateInventoryValidator_RejectsNegativeOnHandAndMissingReason()
    {
        var validator = new UpdateInventoryValidator();

        var result = validator.Validate(new UpdateInventoryRequest { OnHandQty = -1, Reason = string.Empty });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Reason is required.");
        Assert.Contains(result.Errors, e => e.ErrorMessage == "On-hand quantity must be non-negative.");
    }

    [Fact]
    public void AdjustInventoryValidator_RequiresPlantAndReasonAndNonZeroDelta()
    {
        var validator = new AdjustInventoryValidator();

        var result = validator.Validate(new AdjustInventoryRequest
        {
            PlantId = Guid.Empty,
            Reason = string.Empty,
            DeltaQty = 0
        });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Plant ID is required.");
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Reason is required.");
        Assert.Contains(result.Errors, e => e.ErrorMessage == "Delta quantity must not be zero.");
    }
}
