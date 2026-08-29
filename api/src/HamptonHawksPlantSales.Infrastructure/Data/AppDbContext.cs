using HamptonHawksPlantSales.Core.Models;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<AppUser> AppUsers => Set<AppUser>();
    public DbSet<AppUserRole> AppUserRoles => Set<AppUserRole>();
    public DbSet<AppSettings> AppSettings => Set<AppSettings>();
    public DbSet<PlantCatalog> PlantCatalogs => Set<PlantCatalog>();
    public DbSet<Inventory> Inventories => Set<Inventory>();
    public DbSet<InventoryAdjustment> InventoryAdjustments => Set<InventoryAdjustment>();
    public DbSet<Seller> Sellers => Set<Seller>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderLine> OrderLines => Set<OrderLine>();
    public DbSet<FulfillmentEvent> FulfillmentEvents => Set<FulfillmentEvent>();
    public DbSet<ImportBatch> ImportBatches => Set<ImportBatch>();
    public DbSet<ImportIssue> ImportIssues => Set<ImportIssue>();
    public DbSet<AdminAction> AdminActions => Set<AdminAction>();
    public DbSet<ScanSession> ScanSessions => Set<ScanSession>();
    public DbSet<ScanSessionMember> ScanSessionMembers => Set<ScanSessionMember>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        // Seed a single AppSettings row
        var appSettingsId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        modelBuilder.Entity<AppSettings>().HasData(new AppSettings
        {
            Id = appSettingsId,
            SaleClosed = false,
            SaleClosedAt = null,
            CreatedAt = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero),
            UpdatedAt = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero),
            DeletedAt = null
        });
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    if (entry.Entity.Id == Guid.Empty)
                        entry.Entity.Id = Guid.NewGuid();
                    entry.Entity.CreatedAt = now;
                    entry.Entity.UpdatedAt = now;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    break;
            }
        }

        // Pick-list barcodes are unique (filtered on DeletedAt IS NULL) but no
        // caller assigns them, so a second new customer or seller would fail the
        // insert with 23505. Assign here so every creation path is covered.
        foreach (var entry in ChangeTracker.Entries<Customer>())
        {
            if (entry.State == EntityState.Added && string.IsNullOrWhiteSpace(entry.Entity.PicklistBarcode))
                entry.Entity.PicklistBarcode = NewPicklistBarcode("PLB-");
        }

        foreach (var entry in ChangeTracker.Entries<Seller>())
        {
            if (entry.State == EntityState.Added && string.IsNullOrWhiteSpace(entry.Entity.PicklistBarcode))
                entry.Entity.PicklistBarcode = NewPicklistBarcode("PLS-");
        }

        foreach (var entry in ChangeTracker.Entries<EventEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.Id == Guid.Empty)
                    entry.Entity.Id = Guid.NewGuid();
                entry.Entity.CreatedAt = now;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Same shape the AddPicklistBarcodes migration backfilled: prefix + 8 hex chars.
    /// </summary>
    public static string NewPicklistBarcode(string prefix) =>
        prefix + Convert.ToHexString(Guid.NewGuid().ToByteArray(), 0, 4).ToLowerInvariant();
}
