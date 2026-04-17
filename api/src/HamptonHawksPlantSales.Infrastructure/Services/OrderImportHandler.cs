using System.Text.Json;
using HamptonHawksPlantSales.Core.Enums;
using HamptonHawksPlantSales.Core.Models;
using HamptonHawksPlantSales.Infrastructure.Data;
using FluentValidation;
using Microsoft.EntityFrameworkCore;

namespace HamptonHawksPlantSales.Infrastructure.Services;

public class OrderImportHandler
{
    private readonly AppDbContext _db;

    public OrderImportHandler(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(int imported, int skipped, List<ImportIssue> issues)> HandleAsync(
        Guid batchId, List<Dictionary<string, string>> rows, bool resolveDuplicateOrderNumbers = false)
    {
        int imported = 0;
        int skipped = 0;
        var issues = new List<ImportIssue>();

        // Load plant catalog by SKU
        var plants = await _db.PlantCatalogs
            .Where(p => p.DeletedAt == null)
            .ToDictionaryAsync(p => p.Sku, p => p.Id, StringComparer.OrdinalIgnoreCase);

        // Load existing customers by PickupCode and DisplayName
        var customersByPickupCode = await _db.Customers
            .Where(c => c.DeletedAt == null && c.PickupCode != "")
            .ToDictionaryAsync(c => c.PickupCode, c => c, StringComparer.OrdinalIgnoreCase);
        var customersByDisplayName = (await _db.Customers
            .Where(c => c.DeletedAt == null)
            .ToListAsync())
            .GroupBy(c => c.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        // Load existing sellers by DisplayName
        var sellersByDisplayName = (await _db.Sellers
            .Where(s => s.DeletedAt == null)
            .ToListAsync())
            .GroupBy(s => s.DisplayName, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var existingNumbers = await _db.Orders
            .Where(o => o.DeletedAt == null)
            .Select(o => o.OrderNumber)
            .ToListAsync();
        var usedOrderNumbers = new HashSet<string>(existingNumbers, StringComparer.OrdinalIgnoreCase);
        var maxExistingInt = existingNumbers
            .Select(n => int.TryParse(n, out var i) ? i : 0)
            .DefaultIfEmpty(0)
            .Max();

        // Group rows by OrderNumber
        var grouped = new List<(string orderNumber, List<(Dictionary<string, string> row, int rowNumber)> lines)>();
        var orderNumberCounter = 0;

        for (int i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            var orderNumber = row.GetValueOrDefault("OrderNumber")?.Trim() ?? "";

            if (string.IsNullOrWhiteSpace(orderNumber))
            {
                orderNumber = (maxExistingInt + (++orderNumberCounter)).ToString();
            }

            var existing = grouped.Find(g => g.orderNumber.Equals(orderNumber, StringComparison.OrdinalIgnoreCase));
            if (existing.orderNumber != null)
            {
                existing.lines.Add((row, i + 2));
            }
            else
            {
                grouped.Add((orderNumber, new List<(Dictionary<string, string> row, int rowNumber)> { (row, i + 2) }));
            }
        }

        foreach (var (orderNumber, lines) in grouped)
        {
            var resolvedOrderNumber = ResolveOrderNumber(orderNumber, usedOrderNumbers, resolveDuplicateOrderNumbers);
            var firstRow = lines[0].row;

            // Resolve customer
            var customerFirstName = firstRow.GetValueOrDefault("CustomerFirstName")?.Trim();
            var customerLastName = firstRow.GetValueOrDefault("CustomerLastName")?.Trim();
            var customerDisplayName = firstRow.GetValueOrDefault("CustomerDisplayName")?.Trim() ?? "";
            var phone = firstRow.GetValueOrDefault("Phone")?.Trim();
            var email = firstRow.GetValueOrDefault("Email")?.Trim();
            var pickupCode = firstRow.GetValueOrDefault("PickupCode")?.Trim() ?? "";
            var isWalkUpStr = firstRow.GetValueOrDefault("IsWalkUp")?.Trim() ?? "";

            // Build display name if empty
            if (string.IsNullOrWhiteSpace(customerDisplayName))
            {
                if (!string.IsNullOrWhiteSpace(customerFirstName) || !string.IsNullOrWhiteSpace(customerLastName))
                {
                    customerDisplayName = $"{customerFirstName} {customerLastName}".Trim();
                }
                else
                {
                    // CustomerDisplayName required if first/last both missing
                    foreach (var (_, rowNum) in lines)
                    {
                        issues.Add(new ImportIssue
                        {
                            ImportBatchId = batchId,
                            RowNumber = rowNum,
                            IssueType = "MissingCustomerName",
                            Message = "CustomerDisplayName is required when FirstName and LastName are both missing.",
                            RawData = JsonSerializer.Serialize(firstRow)
                        });
                        skipped++;
                    }
                    continue;
                }
            }

            // Find or create customer
            Customer? customer = null;
            if (!string.IsNullOrWhiteSpace(pickupCode) && customersByPickupCode.TryGetValue(pickupCode, out var existingByCode))
            {
                customer = existingByCode;
            }
            else if (customersByDisplayName.TryGetValue(customerDisplayName, out var existingByName))
            {
                customer = existingByName;
            }

            if (customer == null)
            {
                if (string.IsNullOrWhiteSpace(pickupCode))
                {
                    pickupCode = GeneratePickupCode();
                }

                customer = new Customer
                {
                    FirstName = string.IsNullOrWhiteSpace(customerFirstName) ? null : customerFirstName,
                    LastName = string.IsNullOrWhiteSpace(customerLastName) ? null : customerLastName,
                    DisplayName = customerDisplayName,
                    Phone = string.IsNullOrWhiteSpace(phone) ? null : phone,
                    Email = string.IsNullOrWhiteSpace(email) ? null : email,
                    PickupCode = pickupCode
                };
                _db.Customers.Add(customer);
                customersByPickupCode[pickupCode] = customer;
                customersByDisplayName[customerDisplayName] = customer;
            }

            // Resolve seller (optional)
            Seller? seller = null;
            var sellerFirstName = firstRow.GetValueOrDefault("SellerFirstName")?.Trim();
            var sellerLastName = firstRow.GetValueOrDefault("SellerLastName")?.Trim();
            var sellerDisplayName = firstRow.GetValueOrDefault("SellerDisplayName")?.Trim() ?? "";

            if (string.IsNullOrWhiteSpace(sellerDisplayName) &&
                (!string.IsNullOrWhiteSpace(sellerFirstName) || !string.IsNullOrWhiteSpace(sellerLastName)))
            {
                sellerDisplayName = $"{sellerFirstName} {sellerLastName}".Trim();
            }

            if (!string.IsNullOrWhiteSpace(sellerDisplayName))
            {
                if (!sellersByDisplayName.TryGetValue(sellerDisplayName, out seller))
                {
                    seller = new Seller
                    {
                        FirstName = string.IsNullOrWhiteSpace(sellerFirstName) ? null : sellerFirstName,
                        LastName = string.IsNullOrWhiteSpace(sellerLastName) ? null : sellerLastName,
                        DisplayName = sellerDisplayName
                    };
                    _db.Sellers.Add(seller);
                    sellersByDisplayName[sellerDisplayName] = seller;
                }
            }

            bool isWalkUp = false;
            if (!string.IsNullOrWhiteSpace(isWalkUpStr))
                bool.TryParse(isWalkUpStr, out isWalkUp);

            // Process order lines
            var validLines = new List<(Guid plantId, int qty)>();
            foreach (var (row, rowNumber) in lines)
            {
                var rawData = JsonSerializer.Serialize(row);
                var sku = row.GetValueOrDefault("Sku")?.Trim() ?? "";
                var qtyStr = row.GetValueOrDefault("QtyOrdered")?.Trim() ?? "1";

                if (string.IsNullOrWhiteSpace(sku))
                {
                    issues.Add(new ImportIssue
                    {
                        ImportBatchId = batchId,
                        RowNumber = rowNumber,
                        IssueType = "MissingSku",
                        Sku = sku,
                        Message = "Sku is required for order line.",
                        RawData = rawData
                    });
                    skipped++;
                    continue;
                }

                if (!plants.TryGetValue(sku, out var plantId))
                {
                    issues.Add(new ImportIssue
                    {
                        ImportBatchId = batchId,
                        RowNumber = rowNumber,
                        IssueType = "UnknownSku",
                        Sku = sku,
                        Message = $"No plant found with Sku '{sku}'.",
                        RawData = rawData
                    });
                    skipped++;
                    continue;
                }

                if (!int.TryParse(qtyStr, out var qty) || qty < 1)
                    qty = 1;

                validLines.Add((plantId, qty));
                imported++;
            }

            // Only create order if at least one valid line
            if (validLines.Count > 0)
            {
                var order = new Order
                {
                    CustomerId = customer.Id,
                    SellerId = seller?.Id,
                    OrderNumber = resolvedOrderNumber,
                    Barcode = OrderService.BuildOrderBarcode(resolvedOrderNumber),
                    Status = OrderStatus.Open,
                    IsWalkUp = isWalkUp
                };
                _db.Orders.Add(order);

                foreach (var (plantId, qty) in validLines)
                {
                    _db.OrderLines.Add(new OrderLine
                    {
                        OrderId = order.Id,
                        PlantCatalogId = plantId,
                        QtyOrdered = qty,
                        QtyFulfilled = 0
                    });
                }
            }
        }

        return (imported, skipped, issues);
    }

    private static string GeneratePickupCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = Random.Shared;
        return new string(Enumerable.Range(0, 6).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }

    private static string ResolveOrderNumber(string requestedOrderNumber, HashSet<string> usedOrderNumbers, bool resolveDuplicateOrderNumbers)
    {
        if (usedOrderNumbers.Add(requestedOrderNumber))
        {
            return requestedOrderNumber;
        }

        if (!resolveDuplicateOrderNumbers)
        {
            throw new ValidationException(
                $"Order number '{requestedOrderNumber}' already exists. Confirm import to create a new order number automatically.");
        }

        var suffix = 2;
        string candidate;
        do
        {
            candidate = $"{requestedOrderNumber}-{suffix}";
            suffix++;
        } while (!usedOrderNumbers.Add(candidate));

        return candidate;
    }
}

