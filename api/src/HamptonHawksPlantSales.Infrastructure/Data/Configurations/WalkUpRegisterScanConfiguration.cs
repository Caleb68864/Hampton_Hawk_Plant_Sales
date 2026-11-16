using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class WalkUpRegisterScanConfiguration : IEntityTypeConfiguration<WalkUpRegisterScan>
{
    public void Configure(EntityTypeBuilder<WalkUpRegisterScan> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.Property(e => e.ScanId).HasColumnType("text").IsRequired();

        // Scoped per draft, like FulfillmentEvents' (OrderId, IdempotencyKey). The
        // in-transaction replay check runs under the plant row lock; the unique index
        // is the last line of defence if two retries ever race past it.
        builder.HasIndex(e => new { e.OrderId, e.ScanId }).IsUnique();

        builder.HasOne(e => e.Order)
            .WithMany()
            .HasForeignKey(e => e.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.PlantCatalog)
            .WithMany()
            .HasForeignKey(e => e.PlantCatalogId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
