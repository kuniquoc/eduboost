using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EduBoost.API.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class StabilizeThetaWithResponseBeta : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EstimatorVersion",
                table: "irt_ability_states",
                type: "integer",
                nullable: false,
                defaultValue: 2);

            // Existing states were estimated with the current IrtItem.Beta. Mark them
            // for the startup backfill that switches historical evidence to snapshots.
            migrationBuilder.Sql("""
                UPDATE irt_ability_states
                SET "EstimatorVersion" = 1;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EstimatorVersion",
                table: "irt_ability_states");
        }
    }
}
