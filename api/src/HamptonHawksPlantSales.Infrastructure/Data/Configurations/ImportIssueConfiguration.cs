using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HamptonHawksPlantSales.Infrastructure.Data.Configurations;

public class ImportIssueConfiguration : IEntityTypeConfiguration<ImportIssue>
{
    public void Configure(EntityTypeBuilder<ImportIssue> builder)
    {
        builder.HasQueryFilter(e => e.DeletedAt == null);

        builder.Property(e => e.IssueType).HasColumnType("text").IsRequired();
        builder.Property(e => e.Barcode).HasColumnType("text");
        builder.Property(e => e.Sku).HasColumnType("text");
        builder.Property(e => e.Message).HasColumnType("text").IsRequired();
        builder.Property(e => e.RawData).HasColumnType("jsonb");

        builder.HasIndex(e => e.ImportBatchId);

        builder.HasOne(e => e.ImportBatch)
            .WithMany(b => b.Issues)
            .HasForeignKey(e => e.ImportBatchId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
