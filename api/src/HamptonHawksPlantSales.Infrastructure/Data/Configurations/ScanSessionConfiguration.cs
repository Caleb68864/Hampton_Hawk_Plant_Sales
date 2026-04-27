using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class ScanSessionConfiguration : IEntityTypeConfiguration<ScanSession>
{
    public void Configure(EntityTypeBuilder<ScanSession> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.Property(e => e.WorkstationName).HasColumnType("text").IsRequired();
        builder.Property(e => e.EntityKind)
            .HasConversion<string>()
            .HasColumnType("text")
            .IsRequired();
        builder.Property(e => e.EntityId).IsRequired(false);
        builder.Property(e => e.ClosedAt).IsRequired(false);
        builder.Property(e => e.ExpiresAt).IsRequired();

        builder.HasIndex(e => new { e.EntityKind, e.EntityId });
        builder.HasIndex(e => e.ClosedAt);
        builder.HasIndex(e => e.ExpiresAt);
    }
}
