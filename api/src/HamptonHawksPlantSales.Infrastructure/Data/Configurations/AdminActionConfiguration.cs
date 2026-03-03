using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class AdminActionConfiguration : IEntityTypeConfiguration<AdminAction>
{
    public void Configure(EntityTypeBuilder<AdminAction> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.Property(e => e.ActionType).HasColumnType("text").IsRequired();
        builder.Property(e => e.EntityType).HasColumnType("text").IsRequired();
        builder.Property(e => e.Reason).HasColumnType("text").IsRequired();
        builder.Property(e => e.Message).HasColumnType("text");
    }
}
