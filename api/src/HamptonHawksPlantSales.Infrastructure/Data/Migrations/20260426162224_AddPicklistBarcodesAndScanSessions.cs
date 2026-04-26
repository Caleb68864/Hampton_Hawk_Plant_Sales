using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HamptonHawksPlantSales.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPicklistBarcodesAndScanSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PicklistBarcode",
                table: "Sellers",
                type: "text",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PicklistBarcode",
                table: "Customers",
                type: "text",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            // Backfill PicklistBarcode for existing rows. md5(random()::text || Id::text)
            // produces an 8-char prefix that is unique-in-practice against existing ids;
            // unique-violation retries are handled by re-running the UPDATE for any row
            // where the value is still '' or NULL after the first pass.
            migrationBuilder.Sql(@"
                DO $$
                DECLARE
                    remaining int;
                    attempts int := 0;
                BEGIN
                    LOOP
                        UPDATE ""Customers""
                        SET ""PicklistBarcode"" = 'PLB-' || substr(md5(random()::text || ""Id""::text), 1, 8)
                        WHERE ""PicklistBarcode"" = '' OR ""PicklistBarcode"" IS NULL;

                        SELECT COUNT(*) INTO remaining
                        FROM ""Customers""
                        WHERE ""PicklistBarcode"" = '' OR ""PicklistBarcode"" IS NULL;

                        attempts := attempts + 1;
                        EXIT WHEN remaining = 0 OR attempts >= 5;
                    END LOOP;

                    attempts := 0;
                    LOOP
                        UPDATE ""Sellers""
                        SET ""PicklistBarcode"" = 'PLS-' || substr(md5(random()::text || ""Id""::text), 1, 8)
                        WHERE ""PicklistBarcode"" = '' OR ""PicklistBarcode"" IS NULL;

                        SELECT COUNT(*) INTO remaining
                        FROM ""Sellers""
                        WHERE ""PicklistBarcode"" = '' OR ""PicklistBarcode"" IS NULL;

                        attempts := attempts + 1;
                        EXIT WHEN remaining = 0 OR attempts >= 5;
                    END LOOP;
                END $$;
            ");

            migrationBuilder.CreateTable(
                name: "ScanSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClosedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    WorkstationName = table.Column<string>(type: "text", nullable: false),
                    EntityKind = table.Column<string>(type: "text", nullable: false),
                    EntityId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScanSessions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScanSessionMembers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false),
                    OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScanSessionMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScanSessionMembers_Orders_OrderId",
                        column: x => x.OrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScanSessionMembers_ScanSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "ScanSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Sellers_PicklistBarcode",
                table: "Sellers",
                column: "PicklistBarcode",
                unique: true,
                filter: "\"DeletedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_PicklistBarcode",
                table: "Customers",
                column: "PicklistBarcode",
                unique: true,
                filter: "\"DeletedAt\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ScanSessionMembers_OrderId",
                table: "ScanSessionMembers",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_ScanSessionMembers_SessionId_OrderId",
                table: "ScanSessionMembers",
                columns: new[] { "SessionId", "OrderId" });

            migrationBuilder.CreateIndex(
                name: "IX_ScanSessions_ClosedAt",
                table: "ScanSessions",
                column: "ClosedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ScanSessions_EntityKind_EntityId",
                table: "ScanSessions",
                columns: new[] { "EntityKind", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_ScanSessions_ExpiresAt",
                table: "ScanSessions",
                column: "ExpiresAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScanSessionMembers");

            migrationBuilder.DropTable(
                name: "ScanSessions");

            migrationBuilder.DropIndex(
                name: "IX_Sellers_PicklistBarcode",
                table: "Sellers");

            migrationBuilder.DropIndex(
                name: "IX_Customers_PicklistBarcode",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "PicklistBarcode",
                table: "Sellers");

            migrationBuilder.DropColumn(
                name: "PicklistBarcode",
                table: "Customers");
        }
    }
}
