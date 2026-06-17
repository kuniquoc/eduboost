using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduBoost.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSpacedRepetition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "spaced_repetition_items");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "spaced_repetition_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    EaseFactor = table.Column<double>(type: "double precision", nullable: false),
                    LastReviewDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextReviewDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RepetitionCount = table.Column<int>(type: "integer", nullable: false),
                    RetentionScore = table.Column<double>(type: "double precision", nullable: false),
                    ReviewInterval = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_spaced_repetition_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_spaced_repetition_items_questions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "questions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_spaced_repetition_items_topics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "topics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_spaced_repetition_items_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_spaced_repetition_items_NextReviewDate",
                table: "spaced_repetition_items",
                column: "NextReviewDate");

            migrationBuilder.CreateIndex(
                name: "IX_spaced_repetition_items_QuestionId",
                table: "spaced_repetition_items",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_spaced_repetition_items_TopicId",
                table: "spaced_repetition_items",
                column: "TopicId");

            migrationBuilder.CreateIndex(
                name: "IX_spaced_repetition_items_UserId_QuestionId",
                table: "spaced_repetition_items",
                columns: new[] { "UserId", "QuestionId" },
                unique: true);
        }
    }
}
