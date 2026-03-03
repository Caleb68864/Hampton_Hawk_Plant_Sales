using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamptonHawksPlantSales.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class FilterSoftDeletedFromUniqueIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PlantCatalogs_Barcode",
                table: "PlantCatalogs");

            migrationBuilder.DropIndex(
                name: "IX_PlantCatalogs_Sku",
                table: "PlantCatalogs");

            migrationBuilder.CreateIndex(
                name: "IX_PlantCatalogs_Barcode",
                table: "PlantCatalogs",
                column: "Barcode",
                unique: true,
                filter: "\"DeletedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PlantCatalogs_Sku",
                table: "PlantCatalogs",
                column: "Sku",
                unique: true,
                filter: "\"DeletedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PlantCatalogs_Barcode",
                table: "PlantCatalogs");

            migrationBuilder.DropIndex(
                name: "IX_PlantCatalogs_Sku",
                table: "PlantCatalogs");

            migrationBuilder.CreateIndex(
                name: "IX_PlantCatalogs_Barcode",
                table: "PlantCatalogs",
                column: "Barcode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlantCatalogs_Sku",
                table: "PlantCatalogs",
                column: "Sku",
                unique: true);
        }
    }
}
