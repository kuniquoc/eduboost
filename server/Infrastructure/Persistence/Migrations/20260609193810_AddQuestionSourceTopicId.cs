using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduBoost.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionSourceTopicId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SourceTopicId",
                table: "questions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_questions_SourceTopicId",
                table: "questions",
                column: "SourceTopicId");

            migrationBuilder.AddForeignKey(
                name: "FK_questions_topics_SourceTopicId",
                table: "questions",
                column: "SourceTopicId",
                principalTable: "topics",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_questions_topics_SourceTopicId",
                table: "questions");

            migrationBuilder.DropIndex(
                name: "IX_questions_SourceTopicId",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "SourceTopicId",
                table: "questions");
        }
    }
}
