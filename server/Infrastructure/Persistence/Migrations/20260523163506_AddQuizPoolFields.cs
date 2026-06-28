using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduBoost.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuizPoolFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "ClassId",
                table: "topics",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerId",
                table: "topics",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerId",
                table: "quizzes",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_topics_OwnerId",
                table: "topics",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_quizzes_OwnerId",
                table: "quizzes",
                column: "OwnerId");

            migrationBuilder.AddForeignKey(
                name: "FK_quizzes_users_OwnerId",
                table: "quizzes",
                column: "OwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_topics_users_OwnerId",
                table: "topics",
                column: "OwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_quizzes_users_OwnerId",
                table: "quizzes");

            migrationBuilder.DropForeignKey(
                name: "FK_topics_users_OwnerId",
                table: "topics");

            migrationBuilder.DropIndex(
                name: "IX_topics_OwnerId",
                table: "topics");

            migrationBuilder.DropIndex(
                name: "IX_quizzes_OwnerId",
                table: "quizzes");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "topics");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "quizzes");

            migrationBuilder.AlterColumn<Guid>(
                name: "ClassId",
                table: "topics",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
