using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.Property(e => e.OrderNumber).HasColumnType("text").IsRequired();
        builder.Property(e => e.Barcode).HasColumnType("text");
        builder.Property(e => e.CustomerId).IsRequired(false);
        builder.Property(e => e.PaymentMethod).HasColumnType("text");
        builder.Property(e => e.AmountTendered).HasColumnType("numeric(12,2)");

        builder.HasIndex(e => e.OrderNumber).IsUnique();
        builder.HasIndex(e => e.Barcode)
            .IsUnique()
            .HasFilter("\"Barcode\" IS NOT NULL AND \"DeletedAt\" IS NULL");
        builder.HasIndex(e => e.CustomerId);
        builder.HasIndex(e => e.SellerId);

        builder.Property(e => e.Status)
            .HasConversion<string>()
            .HasColumnType("text");

        builder.HasOne(e => e.Customer)
            .WithMany()
            .HasForeignKey(e => e.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Seller)
            .WithMany()
            .HasForeignKey(e => e.SellerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
