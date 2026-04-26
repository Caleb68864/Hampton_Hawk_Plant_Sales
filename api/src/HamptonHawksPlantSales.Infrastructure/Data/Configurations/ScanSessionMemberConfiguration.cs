using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class ScanSessionMemberConfiguration : IEntityTypeConfiguration<ScanSessionMember>
{
    public void Configure(EntityTypeBuilder<ScanSessionMember> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.Property(e => e.SessionId).IsRequired();
        builder.Property(e => e.OrderId).IsRequired();

        builder.HasIndex(e => new { e.SessionId, e.OrderId });

        builder.HasOne(e => e.Session)
            .WithMany(s => s.Members)
            .HasForeignKey(e => e.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Order)
            .WithMany()
            .HasForeignKey(e => e.OrderId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
