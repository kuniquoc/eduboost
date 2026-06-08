using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduBoost.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSessionPersistenceAndAvatar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AvatarUrl",
                table: "users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ClassId",
                table: "placement_test_results",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "placement_test_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClassId = table.Column<Guid>(type: "uuid", nullable: true),
                    StateJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_placement_test_sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_placement_test_sessions_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "practice_active_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    StateJson = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_practice_active_sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_practice_active_sessions_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_placement_test_sessions_UserId_ClassId",
                table: "placement_test_sessions",
                columns: new[] { "UserId", "ClassId" });

            migrationBuilder.CreateIndex(
                name: "IX_practice_active_sessions_UserId",
                table: "practice_active_sessions",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "placement_test_sessions");

            migrationBuilder.DropTable(
                name: "practice_active_sessions");

            migrationBuilder.DropColumn(
                name: "AvatarUrl",
                table: "users");

            migrationBuilder.DropColumn(
                name: "ClassId",
                table: "placement_test_results");
        }
    }
}
