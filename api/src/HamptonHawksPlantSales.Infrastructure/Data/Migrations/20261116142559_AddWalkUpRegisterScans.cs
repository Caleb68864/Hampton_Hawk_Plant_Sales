using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamptonHawksPlantSales.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWalkUpRegisterScans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WalkUpRegisterScans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScanId = table.Column<string>(type: "text", nullable: false),
                    PlantCatalogId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WalkUpRegisterScans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WalkUpRegisterScans_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WalkUpRegisterScans_PlantCatalogs_PlantCatalogId",
                        column: x => x.PlantCatalogId,
                        principalTable: "PlantCatalogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WalkUpRegisterScans_OrderId_ScanId",
                table: "WalkUpRegisterScans",
                columns: new[] { "OrderId", "ScanId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WalkUpRegisterScans_PlantCatalogId",
                table: "WalkUpRegisterScans",
                column: "PlantCatalogId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WalkUpRegisterScans");
        }
    }
}
