using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduBoost.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CompleteIrtRefactor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "IrtItemId",
                table: "questions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "irt_ability_states",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    Theta = table.Column<double>(type: "double precision", nullable: false),
                    StandardError = table.Column<double>(type: "double precision", nullable: false),
                    ResponseCount = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_irt_ability_states", x => x.Id);
                    table.ForeignKey(
                        name: "FK_irt_ability_states_topics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "topics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_irt_ability_states_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "irt_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InitialBeta = table.Column<double>(type: "double precision", nullable: false),
                    Beta = table.Column<double>(type: "double precision", nullable: false),
                    BetaStandardError = table.Column<double>(type: "double precision", nullable: true),
                    CalibrationSampleCount = table.Column<int>(type: "integer", nullable: false),
                    PriorSource = table.Column<string>(type: "text", nullable: false),
                    CalibrationStatus = table.Column<string>(type: "text", nullable: false),
                    CalibratedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_irt_items", x => x.Id);
                });

            migrationBuilder.Sql("""
                INSERT INTO irt_ability_states
                    ("Id", "UserId", "TopicId", "Theta", "StandardError", "ResponseCount", "UpdatedAt")
                SELECT
                    b."Id", b."UserId", b."TopicId", b."IrtTheta", 1.0, 0, b."UpdatedAt"
                FROM bkt_states b;

                INSERT INTO irt_items
                    ("Id", "InitialBeta", "Beta", "BetaStandardError", "CalibrationSampleCount",
                     "PriorSource", "CalibrationStatus", "CalibratedAt", "CreatedAt")
                SELECT
                    q."Id",
                    LEAST(3.0, GREATEST(-3.0, q."DifficultyIndex")),
                    LEAST(3.0, GREATEST(-3.0, q."DifficultyIndex")),
                    NULL,
                    0,
                    CASE WHEN q."IsEstimatedDifficultyIndex" THEN 'label' ELSE 'legacy' END,
                    'provisional',
                    NULL,
                    NOW()
                FROM questions q;

                UPDATE questions SET "IrtItemId" = "Id";
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "IrtItemId",
                table: "questions",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "irt_responses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    IrtItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsCorrect = table.Column<bool>(type: "boolean", nullable: false),
                    BetaAtResponse = table.Column<double>(type: "double precision", nullable: false),
                    Source = table.Column<string>(type: "text", nullable: false),
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sequence = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_irt_responses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_irt_responses_irt_items_IrtItemId",
                        column: x => x.IrtItemId,
                        principalTable: "irt_items",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_irt_responses_topics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "topics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_irt_responses_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_questions_IrtItemId",
                table: "questions",
                column: "IrtItemId");

            migrationBuilder.CreateIndex(
                name: "IX_irt_ability_states_TopicId",
                table: "irt_ability_states",
                column: "TopicId");

            migrationBuilder.CreateIndex(
                name: "IX_irt_ability_states_UserId_TopicId",
                table: "irt_ability_states",
                columns: new[] { "UserId", "TopicId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_irt_responses_IrtItemId_UserId_CreatedAt",
                table: "irt_responses",
                columns: new[] { "IrtItemId", "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_irt_responses_TopicId",
                table: "irt_responses",
                column: "TopicId");

            migrationBuilder.CreateIndex(
                name: "IX_irt_responses_UserId_Source_AttemptId_Sequence",
                table: "irt_responses",
                columns: new[] { "UserId", "Source", "AttemptId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_irt_responses_UserId_TopicId_CreatedAt",
                table: "irt_responses",
                columns: new[] { "UserId", "TopicId", "CreatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_questions_irt_items_IrtItemId",
                table: "questions",
                column: "IrtItemId",
                principalTable: "irt_items",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.DropColumn(
                name: "Difficulty",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "DifficultyIndex",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "IsEstimatedDifficultyIndex",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "GuessProbability",
                table: "bkt_states");

            migrationBuilder.DropColumn(
                name: "IrtTheta",
                table: "bkt_states");

            migrationBuilder.DropColumn(
                name: "SlipProbability",
                table: "bkt_states");

            migrationBuilder.DropColumn(
                name: "TransitionProbability",
                table: "bkt_states");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Difficulty",
                table: "questions",
                type: "text",
                nullable: false,
                defaultValue: "medium");

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

            migrationBuilder.AddColumn<double>(
                name: "GuessProbability",
                table: "bkt_states",
                type: "double precision",
                nullable: false,
                defaultValue: 0.4);

            migrationBuilder.AddColumn<double>(
                name: "IrtTheta",
                table: "bkt_states",
                type: "double precision",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "SlipProbability",
                table: "bkt_states",
                type: "double precision",
                nullable: false,
                defaultValue: 0.2);

            migrationBuilder.AddColumn<double>(
                name: "TransitionProbability",
                table: "bkt_states",
                type: "double precision",
                nullable: false,
                defaultValue: 0.05);

            migrationBuilder.Sql("""
                UPDATE questions q
                SET
                    "Difficulty" = CASE
                        WHEN i."Beta" <= -0.6190392084062235 THEN 'easy'
                        WHEN i."Beta" >= 0.6190392084062235 THEN 'hard'
                        ELSE 'medium'
                    END,
                    "DifficultyIndex" = i."Beta",
                    "IsEstimatedDifficultyIndex" = i."PriorSource" = 'label'
                FROM irt_items i
                WHERE q."IrtItemId" = i."Id";

                UPDATE bkt_states b
                SET "IrtTheta" = a."Theta"
                FROM irt_ability_states a
                WHERE a."UserId" = b."UserId" AND a."TopicId" = b."TopicId";
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_questions_irt_items_IrtItemId",
                table: "questions");

            migrationBuilder.DropTable(
                name: "irt_ability_states");

            migrationBuilder.DropTable(
                name: "irt_responses");

            migrationBuilder.DropTable(
                name: "irt_items");

            migrationBuilder.DropIndex(
                name: "IX_questions_IrtItemId",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "IrtItemId",
                table: "questions");
        }
    }
}
