using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduBoost.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLearningEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SourceDocumentId",
                table: "questions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bkt_states",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    MasteryProbability = table.Column<double>(type: "double precision", nullable: false),
                    GuessProbability = table.Column<double>(type: "double precision", nullable: false),
                    SlipProbability = table.Column<double>(type: "double precision", nullable: false),
                    TransitionProbability = table.Column<double>(type: "double precision", nullable: false),
                    IrtTheta = table.Column<double>(type: "double precision", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bkt_states", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bkt_states_topics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "topics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_bkt_states_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "conversation_messages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: true),
                    Role = table.Column<string>(type: "text", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    SourceReferencesJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_conversation_messages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_conversation_messages_topics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "topics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_conversation_messages_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "learning_sessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    QuestionsAttempted = table.Column<int>(type: "integer", nullable: false),
                    CorrectAnswers = table.Column<int>(type: "integer", nullable: false),
                    Score = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_learning_sessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_learning_sessions_topics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "topics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_learning_sessions_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "personalized_learning_paths",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecommendedDifficulty = table.Column<string>(type: "text", nullable: false),
                    PriorityScore = table.Column<double>(type: "double precision", nullable: false),
                    NextReviewDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_personalized_learning_paths", x => x.Id);
                    table.ForeignKey(
                        name: "FK_personalized_learning_paths_topics_TopicId",
                        column: x => x.TopicId,
                        principalTable: "topics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_personalized_learning_paths_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "placement_test_results",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InitialLevel = table.Column<string>(type: "text", nullable: false),
                    FinalScore = table.Column<double>(type: "double precision", nullable: false),
                    StrengthsJson = table.Column<string>(type: "text", nullable: true),
                    WeaknessesJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_placement_test_results", x => x.Id);
                    table.ForeignKey(
                        name: "FK_placement_test_results_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "spaced_repetition_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uuid", nullable: false),
                    TopicId = table.Column<Guid>(type: "uuid", nullable: false),
                    LastReviewDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextReviewDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ReviewInterval = table.Column<double>(type: "double precision", nullable: false),
                    EaseFactor = table.Column<double>(type: "double precision", nullable: false),
                    RetentionScore = table.Column<double>(type: "double precision", nullable: false),
                    RepetitionCount = table.Column<int>(type: "integer", nullable: false)
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

            migrationBuilder.CreateTable(
                name: "user_profiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CurrentLevel = table.Column<string>(type: "text", nullable: false),
                    OverallMasteryScore = table.Column<double>(type: "double precision", nullable: false),
                    PreferredTopics = table.Column<string>(type: "text", nullable: true),
                    LearningStreak = table.Column<int>(type: "integer", nullable: false),
                    LastActiveDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_profiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_profiles_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_questions_SourceDocumentId",
                table: "questions",
                column: "SourceDocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_bkt_states_TopicId",
                table: "bkt_states",
                column: "TopicId");

            migrationBuilder.CreateIndex(
                name: "IX_bkt_states_UserId_TopicId",
                table: "bkt_states",
                columns: new[] { "UserId", "TopicId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_conversation_messages_TopicId",
                table: "conversation_messages",
                column: "TopicId");

            migrationBuilder.CreateIndex(
                name: "IX_conversation_messages_UserId_TopicId_CreatedAt",
                table: "conversation_messages",
                columns: new[] { "UserId", "TopicId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_learning_sessions_TopicId",
                table: "learning_sessions",
                column: "TopicId");

            migrationBuilder.CreateIndex(
                name: "IX_learning_sessions_UserId",
                table: "learning_sessions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_personalized_learning_paths_TopicId",
                table: "personalized_learning_paths",
                column: "TopicId");

            migrationBuilder.CreateIndex(
                name: "IX_personalized_learning_paths_UserId_TopicId",
                table: "personalized_learning_paths",
                columns: new[] { "UserId", "TopicId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_placement_test_results_UserId",
                table: "placement_test_results",
                column: "UserId");

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

            migrationBuilder.CreateIndex(
                name: "IX_user_profiles_UserId",
                table: "user_profiles",
                column: "UserId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_questions_documents_SourceDocumentId",
                table: "questions",
                column: "SourceDocumentId",
                principalTable: "documents",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_questions_documents_SourceDocumentId",
                table: "questions");

            migrationBuilder.DropTable(
                name: "bkt_states");

            migrationBuilder.DropTable(
                name: "conversation_messages");

            migrationBuilder.DropTable(
                name: "learning_sessions");

            migrationBuilder.DropTable(
                name: "personalized_learning_paths");

            migrationBuilder.DropTable(
                name: "placement_test_results");

            migrationBuilder.DropTable(
                name: "spaced_repetition_items");

            migrationBuilder.DropTable(
                name: "user_profiles");

            migrationBuilder.DropIndex(
                name: "IX_questions_SourceDocumentId",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "SourceDocumentId",
                table: "questions");
        }
    }
}
