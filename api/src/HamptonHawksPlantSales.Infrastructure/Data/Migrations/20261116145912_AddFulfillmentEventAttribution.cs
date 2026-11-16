using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamptonHawksPlantSales.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddFulfillmentEventAttribution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "FulfillmentEvents",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "UserId",
                table: "FulfillmentEvents",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_FulfillmentEvents_UserId",
                table: "FulfillmentEvents",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FulfillmentEvents_UserId",
                table: "FulfillmentEvents");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "FulfillmentEvents");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "FulfillmentEvents");
        }
    }
}
