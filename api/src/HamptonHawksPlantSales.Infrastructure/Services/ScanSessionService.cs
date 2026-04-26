using FluentValidation;
using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class ScanSessionService : IScanSessionService
{
    private const string BuyerPrefix = "PLB-";
    private const string StudentPrefix = "PLS-";
    private const string AdHocExpandSettingKey = "scanSessionAdHocExpandEnabled";

    private readonly AppDbContext _db;
    private readonly IAdminService _adminService;
    private readonly IConfiguration _configuration;
    private readonly TimeSpan _sessionTtl;

    public ScanSessionService(AppDbContext db, IAdminService adminService, IConfiguration configuration)
    {
        _db = db;
        _adminService = adminService;
        _configuration = configuration;

        var minutes = _configuration.GetValue<int?>("ScanSessions:DefaultExpiryMinutes") ?? 240;
        _sessionTtl = TimeSpan.FromMinutes(minutes);
    }

    public async Task<ScanSessionResponse> CreateFromPicklistAsync(string scannedBarcode, string workstationName)
    {
        if (string.IsNullOrWhiteSpace(scannedBarcode))
            throw new ValidationException("Scanned barcode is required.");

        if (string.IsNullOrWhiteSpace(workstationName))
            throw new ValidationException("Workstation name is required.");

        var trimmed = scannedBarcode.Trim();

        ScanSessionEntityKind kind;
        Guid entityId;
        string entityName;
        string entityKindLabel;

        if (trimmed.StartsWith(BuyerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var customer = await _db.Customers
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.PicklistBarcode == trimmed && c.DeletedAt == null);

            if (customer == null)
                throw new KeyNotFoundException($"No customer found for pick-list barcode '{trimmed}'.");

            kind = ScanSessionEntityKind.Customer;
            entityId = customer.Id;
            entityName = customer.DisplayName;
            entityKindLabel = "customer";
        }
        else if (trimmed.StartsWith(StudentPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var seller = await _db.Sellers
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.PicklistBarcode == trimmed && s.DeletedAt == null);

            if (seller == null)
                throw new KeyNotFoundException($"No student found for pick-list barcode '{trimmed}'.");

            kind = ScanSessionEntityKind.Seller;
            entityId = seller.Id;
            entityName = seller.DisplayName;
            entityKindLabel = "student";
        }
        else
        {
            throw new ValidationException("Unknown pick-list prefix. Expected PLB- or PLS-.");
        }

        // Find open orders -- excludes Draft.
        var openOrderIds = await _db.Orders
            .AsNoTracking()
            .Where(o => o.DeletedAt == null
                        && o.Status != OrderStatus.Draft
                        && (o.Status == OrderStatus.Open || o.Status == OrderStatus.InProgress)
                        && ((kind == ScanSessionEntityKind.Customer && o.CustomerId == entityId)
                            || (kind == ScanSessionEntityKind.Seller && o.SellerId == entityId)))
            .OrderBy(o => o.CreatedAt)
            .Select(o => o.Id)
            .ToListAsync();

        if (openOrderIds.Count == 0)
            throw new ValidationException($"No open orders for this {entityKindLabel}.");

        var now = DateTimeOffset.UtcNow;
        var session = new ScanSession
        {
            Id = Guid.NewGuid(),
            EntityKind = kind,
            EntityId = entityId,
            WorkstationName = workstationName.Trim(),
            ExpiresAt = now.Add(_sessionTtl),
            ClosedAt = null
        };

        _db.ScanSessions.Add(session);

        foreach (var orderId in openOrderIds)
        {
            _db.ScanSessionMembers.Add(new ScanSessionMember
            {
                Id = Guid.NewGuid(),
                SessionId = session.Id,
                OrderId = orderId
            });
        }

        await _db.SaveChangesAsync();

        return await BuildResponseAsync(session.Id);
    }

    public async Task<ScanSessionResponse> GetAsync(Guid sessionId)
    {
        var session = await _db.ScanSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId)
            ?? throw new KeyNotFoundException("Scan session not found.");

        return await BuildResponseAsync(sessionId, session);
    }

    public async Task<ScanSessionScanResponse> ScanInSessionAsync(Guid sessionId, string plantBarcode)
    {
        if (string.IsNullOrWhiteSpace(plantBarcode))
            throw new ValidationException("Plant barcode is required.");

        plantBarcode = plantBarcode.Trim();

        var sessionExisting = await _db.ScanSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId)
            ?? throw new KeyNotFoundException("Scan session not found.");

        var nowCheck = DateTimeOffset.UtcNow;
        if (sessionExisting.ClosedAt != null || sessionExisting.ExpiresAt < nowCheck)
        {
            return new ScanSessionScanResponse
            {
                Result = ScanSessionResult.Expired,
                Message = "Scan session has expired or been closed.",
                Session = await BuildResponseAsync(sessionId, sessionExisting)
            };
        }

        if (await _adminService.IsSaleClosedAsync())
        {
            return new ScanSessionScanResponse
            {
                Result = ScanSessionResult.SaleClosedBlocked,
                Message = "Sales are currently closed.",
                Session = await BuildResponseAsync(sessionId, sessionExisting)
            };
        }

        var plant = await _db.PlantCatalogs
            .AsNoTracking()
            .FirstOrDefaultAsync(p => (p.Barcode == plantBarcode || p.Sku == plantBarcode) && p.DeletedAt == null);

        if (plant == null)
        {
            return new ScanSessionScanResponse
            {
                Result = ScanSessionResult.NotFound,
                Message = $"Plant barcode/SKU '{plantBarcode}' is not in the catalog.",
                Session = await BuildResponseAsync(sessionId, sessionExisting)
            };
        }

        var memberOrderIds = await _db.ScanSessionMembers
            .AsNoTracking()
            .Where(m => m.SessionId == sessionId && m.DeletedAt == null)
            .Select(m => m.OrderId)
            .ToListAsync();

        if (memberOrderIds.Count == 0)
        {
            return new ScanSessionScanResponse
            {
                Result = ScanSessionResult.NotInSession,
                Message = "Session has no member orders.",
                Plant = new ScanPlantInfo { Sku = plant.Sku, Name = plant.Name },
                Session = await BuildResponseAsync(sessionId, sessionExisting)
            };
        }

        var isRelational = _db.Database.IsRelational();
        var transaction = isRelational
            ? await _db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable)
            : null;

        try
        {
            // Re-load session under transaction with lock to prevent close-race.
            if (isRelational)
            {
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"ScanSessions\" WHERE \"Id\" = {0} FOR UPDATE",
                    sessionId);
            }

            var lockedSession = await _db.ScanSessions
                .FirstOrDefaultAsync(s => s.Id == sessionId);

            var nowTx = DateTimeOffset.UtcNow;
            if (lockedSession == null || lockedSession.ClosedAt != null || lockedSession.ExpiresAt < nowTx)
            {
                if (transaction != null) await transaction.RollbackAsync();
                return new ScanSessionScanResponse
                {
                    Result = ScanSessionResult.Expired,
                    Message = "Scan session has expired or been closed.",
                    Session = await BuildResponseAsync(sessionId, sessionExisting)
                };
            }

            // Find candidate OrderLine: oldest order (by CreatedAt), then oldest line.
            var candidateLineId = await (
                from ol in _db.OrderLines
                join m in _db.ScanSessionMembers on ol.OrderId equals m.OrderId
                join o in _db.Orders on ol.OrderId equals o.Id
                where m.SessionId == sessionId
                      && m.DeletedAt == null
                      && ol.PlantCatalogId == plant.Id
                      && ol.QtyFulfilled < ol.QtyOrdered
                      && ol.DeletedAt == null
                      && o.DeletedAt == null
                      && o.Status != OrderStatus.Draft
                orderby o.CreatedAt, ol.CreatedAt
                select ol.Id
            ).FirstOrDefaultAsync();

            if (candidateLineId == Guid.Empty)
            {
                // Determine if any line for this plant exists in session at all (fully-fulfilled or absent).
                var anyLineForPlant = await (
                    from ol in _db.OrderLines
                    join m in _db.ScanSessionMembers on ol.OrderId equals m.OrderId
                    join o in _db.Orders on ol.OrderId equals o.Id
                    where m.SessionId == sessionId
                          && m.DeletedAt == null
                          && ol.PlantCatalogId == plant.Id
                          && ol.DeletedAt == null
                          && o.DeletedAt == null
                          && o.Status != OrderStatus.Draft
                    select ol.Id
                ).AnyAsync();

                if (transaction != null) await transaction.RollbackAsync();

                return new ScanSessionScanResponse
                {
                    Result = anyLineForPlant ? ScanSessionResult.AlreadyFulfilled : ScanSessionResult.NotInSession,
                    Message = anyLineForPlant
                        ? $"All matching lines for '{plant.Name}' are already fulfilled."
                        : $"Plant '{plant.Name}' is not in any order in this session.",
                    Plant = new ScanPlantInfo { Sku = plant.Sku, Name = plant.Name },
                    Session = await BuildResponseAsync(sessionId, lockedSession)
                };
            }

            // Lock the candidate row + inventory row.
            if (isRelational)
            {
                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"OrderLines\" WHERE \"Id\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    candidateLineId);

                await _db.Database.ExecuteSqlRawAsync(
                    "SELECT 1 FROM \"Inventories\" WHERE \"PlantCatalogId\" = {0} AND \"DeletedAt\" IS NULL FOR UPDATE",
                    plant.Id);
            }

            var lockedLine = await _db.OrderLines
                .FirstOrDefaultAsync(l => l.Id == candidateLineId && l.DeletedAt == null);

            var lockedInventory = await _db.Inventories
                .FirstOrDefaultAsync(i => i.PlantCatalogId == plant.Id && i.DeletedAt == null);

            if (lockedLine == null || lockedInventory == null)
            {
                if (transaction != null) await transaction.RollbackAsync();
                return new ScanSessionScanResponse
                {
                    Result = ScanSessionResult.OutOfStock,
                    Message = "Could not reserve item for fulfillment.",
                    Plant = new ScanPlantInfo { Sku = plant.Sku, Name = plant.Name },
                    Session = await BuildResponseAsync(sessionId, lockedSession)
                };
            }

            if (lockedLine.QtyFulfilled >= lockedLine.QtyOrdered)
            {
                if (transaction != null) await transaction.RollbackAsync();
                return new ScanSessionScanResponse
                {
                    Result = ScanSessionResult.AlreadyFulfilled,
                    Message = $"Line for '{plant.Name}' is already fully fulfilled.",
                    Plant = new ScanPlantInfo { Sku = plant.Sku, Name = plant.Name },
                    Session = await BuildResponseAsync(sessionId, lockedSession)
                };
            }

            if (lockedInventory.OnHandQty <= 0)
            {
                if (transaction != null) await transaction.RollbackAsync();
                return new ScanSessionScanResponse
                {
                    Result = ScanSessionResult.OutOfStock,
                    Message = $"'{plant.Name}' is out of stock.",
                    Plant = new ScanPlantInfo { Sku = plant.Sku, Name = plant.Name },
                    Session = await BuildResponseAsync(sessionId, lockedSession)
                };
            }

            lockedLine.QtyFulfilled += 1;
            lockedInventory.OnHandQty -= 1;

            // Mirror per-order behaviour: bump order Open -> InProgress.
            var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == lockedLine.OrderId && o.DeletedAt == null);
            if (order != null && order.Status == OrderStatus.Open)
                order.Status = OrderStatus.InProgress;

            // Lock plant barcode if not yet locked (mirrors per-order scan).
            var trackedPlant = await _db.PlantCatalogs.FirstOrDefaultAsync(p => p.Id == plant.Id);
            if (trackedPlant != null && trackedPlant.BarcodeLockedAt == null)
                trackedPlant.BarcodeLockedAt = DateTimeOffset.UtcNow;

            var evt = new FulfillmentEvent
            {
                OrderId = lockedLine.OrderId,
                PlantCatalogId = plant.Id,
                Barcode = plantBarcode,
                Result = FulfillmentResult.Accepted,
                Message = $"Session scan: 1x '{plant.Name}'. Fulfilled {lockedLine.QtyFulfilled}/{lockedLine.QtyOrdered}."
            };
            _db.FulfillmentEvents.Add(evt);

            await _db.SaveChangesAsync();
            if (transaction != null) await transaction.CommitAsync();

            // Re-read session for fresh response.
            var refreshedSession = await _db.ScanSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == sessionId);

            return new ScanSessionScanResponse
            {
                Result = ScanSessionResult.Accepted,
                Message = $"Scanned 1x '{plant.Name}'.",
                Plant = new ScanPlantInfo { Sku = plant.Sku, Name = plant.Name },
                Session = await BuildResponseAsync(sessionId, refreshedSession)
            };
        }
        catch
        {
            if (transaction != null) await transaction.RollbackAsync();
            throw;
        }
    }

    public Task<ScanSessionResponse> ExpandAsync(Guid sessionId, IReadOnlyCollection<Guid> additionalOrderIds)
    {
        var enabled = _configuration.GetValue<bool?>(AdHocExpandSettingKey) ?? false;
        if (!enabled)
            throw new InvalidOperationException("Ad-hoc session expansion is disabled.");

        // Stub implementation kept intentionally minimal -- gated off by default per spec.
        throw new NotImplementedException("Ad-hoc session expansion is not implemented in v1.");
    }

    public async Task<ScanSessionResponse> CloseAsync(Guid sessionId)
    {
        var session = await _db.ScanSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId)
            ?? throw new KeyNotFoundException("Scan session not found.");

        if (session.ClosedAt == null)
        {
            session.ClosedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync();
        }

        return await BuildResponseAsync(sessionId, session);
    }

    public async Task<int> ExpireStaleAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var stale = await _db.ScanSessions
            .Where(s => s.ClosedAt == null && s.ExpiresAt < now)
            .ToListAsync(cancellationToken);

        foreach (var s in stale)
            s.ClosedAt = now;

        if (stale.Count > 0)
            await _db.SaveChangesAsync(cancellationToken);

        return stale.Count;
    }

    private async Task<ScanSessionResponse> BuildResponseAsync(Guid sessionId, ScanSession? session = null)
    {
        session ??= await _db.ScanSessions
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == sessionId)
            ?? throw new KeyNotFoundException("Scan session not found.");

        var orderIds = await _db.ScanSessionMembers
            .AsNoTracking()
            .Where(m => m.SessionId == sessionId && m.DeletedAt == null)
            .Select(m => m.OrderId)
            .ToListAsync();

        // Aggregate lines across member orders, excluding Draft orders.
        var aggregated = await (
            from ol in _db.OrderLines.AsNoTracking()
            join o in _db.Orders.AsNoTracking() on ol.OrderId equals o.Id
            join p in _db.PlantCatalogs.AsNoTracking() on ol.PlantCatalogId equals p.Id
            where orderIds.Contains(ol.OrderId)
                  && ol.DeletedAt == null
                  && o.DeletedAt == null
                  && o.Status != OrderStatus.Draft
            group new { ol, p } by new { ol.PlantCatalogId, p.Sku, p.Name } into g
            select new ScanSessionAggregatedLine
            {
                PlantCatalogId = g.Key.PlantCatalogId,
                PlantSku = g.Key.Sku,
                PlantName = g.Key.Name,
                QtyOrdered = g.Sum(x => x.ol.QtyOrdered),
                QtyFulfilled = g.Sum(x => x.ol.QtyFulfilled),
                QtyRemaining = g.Sum(x => x.ol.QtyOrdered - x.ol.QtyFulfilled)
            }
        ).ToListAsync();

        var entityName = string.Empty;
        if (session.EntityId.HasValue)
        {
            entityName = session.EntityKind switch
            {
                ScanSessionEntityKind.Customer => (await _db.Customers.AsNoTracking()
                    .Where(c => c.Id == session.EntityId.Value)
                    .Select(c => c.DisplayName)
                    .FirstOrDefaultAsync()) ?? string.Empty,
                ScanSessionEntityKind.Seller => (await _db.Sellers.AsNoTracking()
                    .Where(s => s.Id == session.EntityId.Value)
                    .Select(s => s.DisplayName)
                    .FirstOrDefaultAsync()) ?? string.Empty,
                _ => string.Empty
            };
        }

        return new ScanSessionResponse
        {
            Id = session.Id,
            EntityKind = session.EntityKind,
            EntityId = session.EntityId,
            EntityName = entityName,
            WorkstationName = session.WorkstationName,
            IncludedOrderIds = orderIds,
            AggregatedLines = aggregated,
            RemainingTotal = aggregated.Sum(a => a.QtyRemaining),
            ExpiresAt = session.ExpiresAt,
            ClosedAt = session.ClosedAt
        };
    }
}
