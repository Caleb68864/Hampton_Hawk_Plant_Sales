using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class PlantCatalogConfiguration : IEntityTypeConfiguration<PlantCatalog>
{
    public void Configure(EntityTypeBuilder<PlantCatalog> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.Property(e => e.Sku).HasColumnType("text").IsRequired();
        builder.Property(e => e.Name).HasColumnType("text").IsRequired();
        builder.Property(e => e.Variant).HasColumnType("text");
        builder.Property(e => e.Price).HasColumnType("numeric(10,2)");
        builder.Property(e => e.Barcode).HasColumnType("text").IsRequired();

        builder.HasIndex(e => e.Sku).IsUnique().HasFilter("\"DeletedAt\" IS NULL");
        builder.HasIndex(e => e.Barcode).IsUnique().HasFilter("\"DeletedAt\" IS NULL");
    }
}
