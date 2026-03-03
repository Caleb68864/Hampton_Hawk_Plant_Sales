using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class InventoryConfiguration : IEntityTypeConfiguration<Inventory>
{
    public void Configure(EntityTypeBuilder<Inventory> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.HasIndex(e => e.PlantCatalogId).IsUnique();

        builder.HasOne(e => e.PlantCatalog)
            .WithOne()
            .HasForeignKey<Inventory>(e => e.PlantCatalogId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
