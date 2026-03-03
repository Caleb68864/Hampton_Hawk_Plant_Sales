using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class CustomerConfiguration : IEntityTypeConfiguration<Customer>
{
    public void Configure(EntityTypeBuilder<Customer> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.Property(e => e.FirstName).HasColumnType("text");
        builder.Property(e => e.LastName).HasColumnType("text");
        builder.Property(e => e.DisplayName).HasColumnType("text").IsRequired();
        builder.Property(e => e.Phone).HasColumnType("text");
        builder.Property(e => e.Email).HasColumnType("text");
        builder.Property(e => e.PickupCode).HasColumnType("text").IsRequired();
        builder.Property(e => e.Notes).HasColumnType("text");

        builder.HasIndex(e => e.PickupCode).IsUnique();
        builder.HasIndex(e => e.LastName);
        builder.HasIndex(e => e.Phone);
    }
}
