using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class SellerConfiguration : IEntityTypeConfiguration<Seller>
{
    public void Configure(EntityTypeBuilder<Seller> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.Property(e => e.FirstName).HasColumnType("text");
        builder.Property(e => e.LastName).HasColumnType("text");
        builder.Property(e => e.DisplayName).HasColumnType("text").IsRequired();
        builder.Property(e => e.Grade).HasColumnType("text");
        builder.Property(e => e.Teacher).HasColumnType("text");
        builder.Property(e => e.Notes).HasColumnType("text");

        builder.HasIndex(e => e.LastName);
        builder.HasIndex(e => e.DisplayName);
    }
}
