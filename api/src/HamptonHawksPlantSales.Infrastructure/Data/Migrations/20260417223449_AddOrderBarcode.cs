using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamptonHawksPlantSales.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderBarcode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Barcode",
                table: "Orders",
                type: "text",
                nullable: true);

            // Backfill: OR + last 10 digits of OrderNumber (zero-padded). Orders whose number has
            // no digits get a NULL barcode; operator can fill those via the admin regenerate action.
            migrationBuilder.Sql(@"
                UPDATE ""Orders""
                SET ""Barcode"" = 'OR' || LPAD(
                    RIGHT(REGEXP_REPLACE(""OrderNumber"", '\D', '', 'g'), 10),
                    10, '0')
                WHERE ""DeletedAt"" IS NULL
                  AND ""Barcode"" IS NULL
                  AND REGEXP_REPLACE(""OrderNumber"", '\D', '', 'g') <> '';
            ");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_Barcode",
                table: "Orders",
                column: "Barcode",
                unique: true,
                filter: "\"Barcode\" IS NOT NULL AND \"DeletedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_Barcode",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Barcode",
                table: "Orders");
        }
    }
}
