using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduBoost.API.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CascadeUserDeletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_classes_users_TeacherId",
                table: "classes");

            migrationBuilder.DropForeignKey(
                name: "FK_documents_classes_ClassId",
                table: "documents");

            migrationBuilder.DropForeignKey(
                name: "FK_documents_users_OwnerId",
                table: "documents");

            migrationBuilder.DropForeignKey(
                name: "FK_quiz_submissions_users_StudentId",
                table: "quiz_submissions");

            migrationBuilder.DropForeignKey(
                name: "FK_quizzes_classes_ClassId",
                table: "quizzes");

            migrationBuilder.AddForeignKey(
                name: "FK_classes_users_TeacherId",
                table: "classes",
                column: "TeacherId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_documents_classes_ClassId",
                table: "documents",
                column: "ClassId",
                principalTable: "classes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_documents_users_OwnerId",
                table: "documents",
                column: "OwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_quiz_submissions_users_StudentId",
                table: "quiz_submissions",
                column: "StudentId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_quizzes_classes_ClassId",
                table: "quizzes",
                column: "ClassId",
                principalTable: "classes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_classes_users_TeacherId",
                table: "classes");

            migrationBuilder.DropForeignKey(
                name: "FK_documents_classes_ClassId",
                table: "documents");

            migrationBuilder.DropForeignKey(
                name: "FK_documents_users_OwnerId",
                table: "documents");

            migrationBuilder.DropForeignKey(
                name: "FK_quiz_submissions_users_StudentId",
                table: "quiz_submissions");

            migrationBuilder.DropForeignKey(
                name: "FK_quizzes_classes_ClassId",
                table: "quizzes");

            migrationBuilder.AddForeignKey(
                name: "FK_classes_users_TeacherId",
                table: "classes",
                column: "TeacherId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_documents_classes_ClassId",
                table: "documents",
                column: "ClassId",
                principalTable: "classes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_documents_users_OwnerId",
                table: "documents",
                column: "OwnerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_quiz_submissions_users_StudentId",
                table: "quiz_submissions",
                column: "StudentId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_quizzes_classes_ClassId",
                table: "quizzes",
                column: "ClassId",
                principalTable: "classes",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
