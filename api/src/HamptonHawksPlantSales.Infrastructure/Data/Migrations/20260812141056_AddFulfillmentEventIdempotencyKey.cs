using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamptonHawksPlantSales.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFulfillmentEventIdempotencyKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IdempotencyKey",
                table: "FulfillmentEvents",
                type: "text",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FulfillmentEvents_OrderId_IdempotencyKey",
                table: "FulfillmentEvents",
                columns: new[] { "OrderId", "IdempotencyKey" },
                unique: true,
                filter: "\"IdempotencyKey\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FulfillmentEvents_OrderId_IdempotencyKey",
                table: "FulfillmentEvents");

            migrationBuilder.DropColumn(
                name: "IdempotencyKey",
                table: "FulfillmentEvents");
        }
    }
}
