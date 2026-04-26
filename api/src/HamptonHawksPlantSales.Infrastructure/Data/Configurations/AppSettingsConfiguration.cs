using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class AppSettingsConfiguration : IEntityTypeConfiguration<AppSettings>
{
    public void Configure(EntityTypeBuilder<AppSettings> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        // Scanner tuning fields with defaults
        builder.Property(e => e.PickupSearchDebounceMs)
            .HasDefaultValue(120);

        builder.Property(e => e.PickupAutoJumpMode)
            .HasDefaultValue(PickupAutoJumpMode.BestMatchWhenSingle)
            .HasConversion<string>();

        builder.Property(e => e.PickupMultiScanEnabled)
            .HasDefaultValue(true);
    }
}
