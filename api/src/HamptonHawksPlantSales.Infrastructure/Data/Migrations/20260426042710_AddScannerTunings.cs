using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamptonHawksPlantSales.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddScannerTunings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PickupAutoJumpMode",
                table: "AppSettings",
                type: "text",
                nullable: false,
                defaultValue: "BestMatchWhenSingle");

            migrationBuilder.AddColumn<bool>(
                name: "PickupMultiScanEnabled",
                table: "AppSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "PickupSearchDebounceMs",
                table: "AppSettings",
                type: "integer",
                nullable: false,
                defaultValue: 120);

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"),
                columns: new[] { "PickupAutoJumpMode", "PickupMultiScanEnabled", "PickupSearchDebounceMs" },
                values: new object[] { "BestMatchWhenSingle", true, 120 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PickupAutoJumpMode",
                table: "AppSettings");

            migrationBuilder.DropColumn(
                name: "PickupMultiScanEnabled",
                table: "AppSettings");

            migrationBuilder.DropColumn(
                name: "PickupSearchDebounceMs",
                table: "AppSettings");
        }
    }
}
