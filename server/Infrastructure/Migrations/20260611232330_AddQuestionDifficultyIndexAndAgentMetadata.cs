using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduBoost.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddQuestionDifficultyIndexAndAgentMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "DifficultyIndex",
                table: "questions",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<bool>(
                name: "IsEstimatedDifficultyIndex",
                table: "questions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(@"
                UPDATE questions
                SET ""DifficultyIndex"" =
                    CASE
                        WHEN LOWER(COALESCE(""Difficulty"", 'medium')) = 'easy' THEN -1.5
                        WHEN LOWER(COALESCE(""Difficulty"", 'medium')) = 'hard' THEN 1.5
                        ELSE 0.0
                    END,
                    ""IsEstimatedDifficultyIndex"" = TRUE;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DifficultyIndex",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "IsEstimatedDifficultyIndex",
                table: "questions");
        }
    }
}
