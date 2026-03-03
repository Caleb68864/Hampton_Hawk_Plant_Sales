using HamptonHawksPlantSales.Core.DTOs;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class AdminService : IAdminService
{
    private readonly AppDbContext _db;

    public AdminService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<AdminAction> LogActionAsync(string actionType, string entityType, Guid entityId, string reason, string? message = null)
    {
        var action = new AdminAction
        {
            ActionType = actionType,
            EntityType = entityType,
            EntityId = entityId,
            Reason = reason,
            Message = message
        };

        _db.AdminActions.Add(action);
        await _db.SaveChangesAsync();
        return action;
    }

    public async Task<bool> IsSaleClosedAsync()
    {
        var settings = await _db.AppSettings.FirstOrDefaultAsync();
        return settings?.SaleClosed ?? false;
    }

    public async Task<List<AdminActionResponse>> GetActionsAsync(Guid? orderId, string? entityType, string? actionType)
    {
        var query = _db.AdminActions.AsQueryable();

        if (orderId.HasValue)
            query = query.Where(a => a.EntityType == "Order" && a.EntityId == orderId.Value);

        if (!string.IsNullOrEmpty(entityType))
            query = query.Where(a => a.EntityType == entityType);

        if (!string.IsNullOrEmpty(actionType))
            query = query.Where(a => a.ActionType == actionType);

        return await query
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new AdminActionResponse
            {
                Id = a.Id,
                ActionType = a.ActionType,
                EntityType = a.EntityType,
                EntityId = a.EntityId,
                Reason = a.Reason,
                Message = a.Message,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync();
    }
}
