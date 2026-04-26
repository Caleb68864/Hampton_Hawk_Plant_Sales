using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class OrderLineConfiguration : IEntityTypeConfiguration<OrderLine>
{
    public void Configure(EntityTypeBuilder<OrderLine> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.Property(e => e.Notes).HasColumnType("text");
        builder.Property(e => e.LastScanIdempotencyKey)
            .HasColumnType("text")
            .HasMaxLength(64);

        builder.HasIndex(e => e.OrderId);
        builder.HasIndex(e => e.PlantCatalogId);
        builder.HasIndex(e => e.LastScanIdempotencyKey);

        builder.HasOne(e => e.Order)
            .WithMany(o => o.OrderLines)
            .HasForeignKey(e => e.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.PlantCatalog)
            .WithMany()
            .HasForeignKey(e => e.PlantCatalogId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.ToTable(t => t.HasCheckConstraint(
            "CK_OrderLine_QtyFulfilled_LessEqual_QtyOrdered",
            "\"QtyFulfilled\" <= \"QtyOrdered\""));
    }
}
