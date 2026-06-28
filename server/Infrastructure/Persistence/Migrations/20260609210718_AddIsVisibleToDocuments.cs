using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduBoost.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIsVisibleToDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsVisible",
                table: "documents",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Data migration: publish documents whose topic already had IsDocumentVisible=true
            migrationBuilder.Sql(@"
                UPDATE documents d
                SET ""IsVisible"" = true
                FROM topics t
                WHERE d.""TopicId"" = t.""Id""
                  AND t.""IsDocumentVisible"" = true;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsVisible",
                table: "documents");
        }
    }
}
