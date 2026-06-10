using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduBoost.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddActiveEntryTestToClass : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ActiveEntryTestId",
                table: "classes",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_classes_ActiveEntryTestId",
                table: "classes",
                column: "ActiveEntryTestId");

            migrationBuilder.AddForeignKey(
                name: "FK_classes_quizzes_ActiveEntryTestId",
                table: "classes",
                column: "ActiveEntryTestId",
                principalTable: "quizzes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_classes_quizzes_ActiveEntryTestId",
                table: "classes");

            migrationBuilder.DropIndex(
                name: "IX_classes_ActiveEntryTestId",
                table: "classes");

            migrationBuilder.DropColumn(
                name: "ActiveEntryTestId",
                table: "classes");
        }
    }
}
