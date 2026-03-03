using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class FulfillmentEventConfiguration : IEntityTypeConfiguration<FulfillmentEvent>
{
    public void Configure(EntityTypeBuilder<FulfillmentEvent> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.Property(e => e.Barcode).HasColumnType("text").IsRequired();
        builder.Property(e => e.Message).HasColumnType("text");
        builder.Property(e => e.Result)
            .HasConversion<string>()
            .HasColumnType("text");

        builder.HasIndex(e => e.OrderId);
        builder.HasIndex(e => e.PlantCatalogId);

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
