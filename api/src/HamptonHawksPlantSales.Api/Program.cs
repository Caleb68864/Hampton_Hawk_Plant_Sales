using System.Text.Json;
using System.Text.Json.Serialization;
using FluentValidation;
using HamptonHawksPlantSales.Api.Configuration;
using HamptonHawksPlantSales.Api.Filters;
using HamptonHawksPlantSales.Api.Middleware;
using HamptonHawksPlantSales.Core.Interfaces;
using HamptonHawksPlantSales.Core.Validators;
using HamptonHawksPlantSales.Infrastructure.Data;
using HamptonHawksPlantSales.Infrastructure.Services;
using HamptonHawksPlantSales.Infrastructure.Services.ImportAdapters;
using HamptonHawksPlantSales.Infrastructure.Services.ImportReading;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Serilog
builder.Host.UseSerilog((context, config) =>
    config.ReadFrom.Configuration(context.Configuration)
        .WriteTo.Console());

// Database
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings__Default is not configured.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// CORS
var allowedCorsOrigins = CorsOriginParser.ParseAllowedOrigins(builder.Configuration);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (allowedCorsOrigins.Length == 0)
        {
            policy.SetIsOriginAllowed(_ => false);
            return;
        }

        policy.WithOrigins(allowedCorsOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Authentication (cookie-based browser sessions)
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "HH.Session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(12);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });

// Authorization with role policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
    options.AddPolicy("PickupCapable", policy => policy.RequireRole("Admin", "Pickup"));
    options.AddPolicy("LookupCapable", policy => policy.RequireRole("Admin", "LookupPrint", "Pickup"));
    options.AddPolicy("POSCapable", policy => policy.RequireRole("Admin", "POS"));
    options.AddPolicy("ReportsCapable", policy => policy.RequireRole("Admin", "Reports"));
});

// Health checks
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString);

// Swagger (dev only configured below)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    var xmlFile = $"{typeof(Program).Assembly.GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
        options.IncludeXmlComments(xmlPath);
});

// FluentValidation
builder.Services.AddValidatorsFromAssemblyContaining<CreatePlantValidator>();

// Application services
builder.Services.AddScoped<IPlantService, PlantService>();
builder.Services.AddScoped<IInventoryService, InventoryService>();
builder.Services.AddScoped<ISellerService, SellerService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<ISettingsService, SettingsService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddSingleton<ExcelRowReader>();
builder.Services.AddSingleton<CsvRowReader>();
builder.Services.AddSingleton<IImportFormatAdapter, HamptonHawks2026OrdersAdapter>();
builder.Services.AddSingleton<IImportFormatAdapter, HamptonHawksR1PlantsAdapter>();
builder.Services.AddSingleton<IImportFormatAdapter, HamptonHawksSbpInventoryAdapter>();
builder.Services.AddSingleton<IImportFormatAdapter, CanonicalOrdersAdapter>();
builder.Services.AddSingleton<IImportFormatAdapter, CanonicalPlantsAdapter>();
builder.Services.AddSingleton<IImportFormatAdapter, CanonicalInventoryAdapter>();
builder.Services.AddSingleton<FormatAdapterRegistry>();
builder.Services.AddScoped<IImportService, ImportService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<IFulfillmentService, FulfillmentService>();
builder.Services.AddScoped<IInventoryProtectionService, InventoryProtectionService>();
builder.Services.AddScoped<IWalkUpService, WalkUpService>();
builder.Services.AddScoped<IWalkUpRegisterService, WalkUpRegisterService>();
builder.Services.AddScoped<IScanSessionService, ScanSessionService>();
builder.Services.AddHostedService<ScanSessionExpiryHostedService>();
builder.Services.AddScoped<AdminPinActionFilter>();

// Controllers + JSON serialization
builder.Services.AddControllers(options =>
    {
        options.Filters.Add<AdminPinActionFilter>();
    })
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

var app = builder.Build();

// Run migrations at startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (db.Database.IsRelational())
        await db.Database.MigrateAsync();
}

// Middleware
app.UseMiddleware<ExceptionHandlerMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseSerilogRequestLogging();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapHealthChecks("/health");
app.MapControllers();

app.MapFallback(async context =>
{
    context.Response.StatusCode = 404;
    context.Response.ContentType = "application/json";
    var response = HamptonHawksPlantSales.Core.DTOs.ApiResponse<object>.Fail("Not found");
    var options = new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase };
    await context.Response.WriteAsync(System.Text.Json.JsonSerializer.Serialize(response, options));
});

app.Run();

public partial class Program { }
