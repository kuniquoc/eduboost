using EduBoost.API.Common.Learning;
using EduBoost.API.Features.Quizzes;
using EduBoost.API.Features.Quizzes.Models;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace EduBoost.API.Tests;

public class QuestionIrtLifecycleTests
{
    [Fact]
    public async Task UpdateQuestionAsync_ContentChange_ForksSharedIrtItem()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var db = database.Context;
        var seed = SeedSharedQuestions(db);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var updated = await CreateRepository(db).UpdateQuestionAsync(seed.FirstQuestionId, new UpdateQuestionRequest
        {
            Text = "Updated question"
        });

        Assert.NotNull(updated);
        Assert.Equal(2, await db.IrtItems.CountAsync());

        var first = await db.Questions.AsNoTracking().SingleAsync(question => question.Id == seed.FirstQuestionId);
        var second = await db.Questions.AsNoTracking().SingleAsync(question => question.Id == seed.SecondQuestionId);
        Assert.NotEqual(seed.IrtItemId, first.IrtItemId);
        Assert.Equal(seed.IrtItemId, second.IrtItemId);

        var originalItem = await db.IrtItems.AsNoTracking().SingleAsync(item => item.Id == seed.IrtItemId);
        Assert.Equal(25, originalItem.CalibrationSampleCount);
        Assert.Equal("calibrated", originalItem.CalibrationStatus);

        var forkedItem = await db.IrtItems.AsNoTracking().SingleAsync(item => item.Id == first.IrtItemId);
        Assert.Equal(0, forkedItem.InitialBeta);
        Assert.Equal(0, forkedItem.Beta);
        Assert.Equal("ai", forkedItem.PriorSource);
        Assert.Equal("provisional", forkedItem.CalibrationStatus);
    }

    [Fact]
    public async Task UpdateQuestionAsync_NoOpContentAndExplanation_DoNotForkOrResetIrtItem()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var db = database.Context;
        var seed = SeedSharedQuestions(db);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var options = await db.QuizOptions.AsNoTracking()
            .Where(option => option.QuestionId == seed.FirstQuestionId)
            .OrderBy(option => option.OrderIndex)
            .Select(option => new OptionDto
            {
                Id = option.Id.ToString(),
                Text = option.Text,
                IsCorrect = option.IsCorrect
            })
            .ToListAsync();

        await CreateRepository(db).UpdateQuestionAsync(seed.FirstQuestionId, new UpdateQuestionRequest
        {
            Text = "First question",
            Explanation = "New explanation",
            Options = options,
            DifficultyBand = "medium",
            InitialIrtBeta = 0
        });

        Assert.Equal(1, await db.IrtItems.CountAsync());
        var item = await db.IrtItems.AsNoTracking().SingleAsync();
        Assert.Equal(25, item.CalibrationSampleCount);
        Assert.Equal("calibrated", item.CalibrationStatus);
        Assert.Equal("New explanation", await db.Questions
            .Where(question => question.Id == seed.FirstQuestionId)
            .Select(question => question.Explanation)
            .SingleAsync());
    }

    [Fact]
    public async Task UpdateQuestionAsync_OnlyBetaChanged_UpdatesExistingItemAndResetsCalibration()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var db = database.Context;
        var seed = SeedSharedQuestions(db);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        await CreateRepository(db).UpdateQuestionAsync(seed.FirstQuestionId, new UpdateQuestionRequest
        {
            InitialIrtBeta = 99
        });

        Assert.Equal(1, await db.IrtItems.CountAsync());
        var item = await db.IrtItems.AsNoTracking().SingleAsync();
        Assert.Equal(3, item.InitialBeta);
        Assert.Equal(3, item.Beta);
        Assert.Equal("teacher", item.PriorSource);
        Assert.Equal(0, item.CalibrationSampleCount);
        Assert.Null(item.BetaStandardError);
        Assert.Null(item.CalibratedAt);
        Assert.Equal("provisional", item.CalibrationStatus);
    }

    [Fact]
    public async Task UpdateQuestionAsync_OnlyDifficultyBandChanged_UsesLabelPrior()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var db = database.Context;
        var seed = SeedSharedQuestions(db);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        await CreateRepository(db).UpdateQuestionAsync(seed.FirstQuestionId, new UpdateQuestionRequest
        {
            DifficultyBand = "hard"
        });

        Assert.Equal(1, await db.IrtItems.CountAsync());
        var item = await db.IrtItems.AsNoTracking().SingleAsync();
        Assert.Equal(IrtScale.HardPrior, item.InitialBeta);
        Assert.Equal(IrtScale.HardPrior, item.Beta);
        Assert.Equal("label", item.PriorSource);
        Assert.Equal("provisional", item.CalibrationStatus);
    }

    [Fact]
    public async Task UpdateQuestionAsync_ForeignOptionId_DoesNotReparentAnotherQuestionsOption()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var db = database.Context;
        var seed = SeedSharedQuestions(db);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var foreignOptionId = await db.QuizOptions.AsNoTracking()
            .Where(option => option.QuestionId == seed.SecondQuestionId)
            .Select(option => option.Id)
            .FirstAsync();
        db.ChangeTracker.Clear();

        await CreateRepository(db).UpdateQuestionAsync(seed.FirstQuestionId, new UpdateQuestionRequest
        {
            Options =
            [
                new OptionDto { Id = foreignOptionId.ToString(), Text = "A", IsCorrect = true },
                new OptionDto { Text = "B", IsCorrect = false }
            ]
        });

        var foreignOption = await db.QuizOptions.AsNoTracking().SingleAsync(option => option.Id == foreignOptionId);
        Assert.Equal(seed.SecondQuestionId, foreignOption.QuestionId);
        var updatedOptionIds = await db.QuizOptions.AsNoTracking()
            .Where(option => option.QuestionId == seed.FirstQuestionId)
            .Select(option => option.Id)
            .ToListAsync();
        Assert.Equal(2, updatedOptionIds.Count);
        Assert.DoesNotContain(foreignOptionId, updatedOptionIds);
    }

    [Fact]
    public async Task UpdateQuestionAsync_SaveFailure_RollsBackBulkDeletedOptions()
    {
        var saveFailure = new FailSaveChangesInterceptor();
        await using var database = await SqliteTestDatabase.CreateAsync(saveFailure);
        var db = database.Context;
        var seed = SeedSharedQuestions(db);
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        saveFailure.Enabled = true;

        await Assert.ThrowsAsync<DbUpdateException>(() => CreateRepository(db).UpdateQuestionAsync(
            seed.FirstQuestionId,
            new UpdateQuestionRequest
            {
                Text = "This update must roll back",
                Options =
                [
                    new OptionDto { Text = "Replacement", IsCorrect = true }
                ]
            }));

        db.ChangeTracker.Clear();
        var persisted = await db.Questions.AsNoTracking()
            .Include(question => question.Options)
            .SingleAsync(question => question.Id == seed.FirstQuestionId);
        Assert.Equal("First question", persisted.Text);
        Assert.Equal(2, persisted.Options.Count);
        Assert.Equal(seed.IrtItemId, persisted.IrtItemId);
        Assert.Single(await db.IrtItems.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task AddQuestionsFromPoolAsync_ReusesIrtItemAndReturnsLoadedDto()
    {
        await using var database = await SqliteTestDatabase.CreateAsync();
        var db = database.Context;
        var sourceQuizId = Guid.NewGuid();
        var targetQuizId = Guid.NewGuid();
        var questionId = Guid.NewGuid();
        var irtItemId = Guid.NewGuid();

        db.Quizzes.AddRange(
            new Quiz { Id = sourceQuizId, Title = "Pool", Type = "pool" },
            new Quiz { Id = targetQuizId, Title = "Target", Type = "practice" });
        db.Questions.Add(new Question
        {
            Id = questionId,
            QuizId = sourceQuizId,
            Text = "Pool question",
            Type = "mcq",
            IrtItem = new IrtItem { Id = irtItemId, InitialBeta = 1, Beta = 1 },
            Options =
            [
                new QuizOption { Id = Guid.NewGuid(), Text = "A", IsCorrect = true, OrderIndex = 0 },
                new QuizOption { Id = Guid.NewGuid(), Text = "B", IsCorrect = false, OrderIndex = 1 }
            ]
        });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();

        var added = await CreateRepository(db).AddQuestionsFromPoolAsync(
            targetQuizId,
            [questionId],
            Guid.NewGuid());

        var dto = Assert.Single(added);
        Assert.Equal(1, dto.IrtBeta);
        Assert.Equal(2, dto.Options.Count);
        Assert.Equal(1, await db.IrtItems.CountAsync());
        var copy = await db.Questions.AsNoTracking().SingleAsync(question => question.QuizId == targetQuizId);
        Assert.Equal(irtItemId, copy.IrtItemId);
    }

    private static QuizzesRepository CreateRepository(AppDbContext db) =>
        new(db, null!, null!, null!, null!);

    private static SeedResult SeedSharedQuestions(AppDbContext db)
    {
        var quizId = Guid.NewGuid();
        var firstQuestionId = Guid.NewGuid();
        var secondQuestionId = Guid.NewGuid();
        var irtItemId = Guid.NewGuid();
        var item = new IrtItem
        {
            Id = irtItemId,
            InitialBeta = 0,
            Beta = 0.4,
            BetaStandardError = 0.2,
            CalibrationSampleCount = 25,
            CalibrationStatus = "calibrated",
            PriorSource = "ai",
            CalibratedAt = DateTime.UtcNow
        };

        db.Quizzes.Add(new Quiz { Id = quizId, Title = "Quiz", Type = "practice" });
        db.Questions.AddRange(
            CreateQuestion(firstQuestionId, quizId, "First question", item),
            CreateQuestion(secondQuestionId, quizId, "Second question", item));

        return new SeedResult(firstQuestionId, secondQuestionId, irtItemId);
    }

    private static Question CreateQuestion(Guid id, Guid quizId, string text, IrtItem item) => new()
    {
        Id = id,
        QuizId = quizId,
        Text = text,
        Type = "mcq",
        IrtItem = item,
        CorrectAnswer = "A",
        Options =
        [
            new QuizOption { Id = Guid.NewGuid(), Text = "A", IsCorrect = true, OrderIndex = 0 },
            new QuizOption { Id = Guid.NewGuid(), Text = "B", IsCorrect = false, OrderIndex = 1 }
        ]
    };

    private sealed record SeedResult(Guid FirstQuestionId, Guid SecondQuestionId, Guid IrtItemId);

    private sealed class SqliteTestDatabase : IAsyncDisposable
    {
        private readonly SqliteConnection connection;
        public AppDbContext Context { get; }

        private SqliteTestDatabase(SqliteConnection connection, AppDbContext context)
        {
            this.connection = connection;
            Context = context;
        }

        public static async Task<SqliteTestDatabase> CreateAsync(IInterceptor? interceptor = null)
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlite(connection);
            if (interceptor != null)
                optionsBuilder.AddInterceptors(interceptor);
            var options = optionsBuilder.Options;
            var context = new AppDbContext(options);
            await context.Database.EnsureCreatedAsync();
            return new SqliteTestDatabase(connection, context);
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await connection.DisposeAsync();
        }
    }

    private sealed class FailSaveChangesInterceptor : SaveChangesInterceptor
    {
        public bool Enabled { get; set; }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (Enabled)
                throw new DbUpdateException("Injected save failure");

            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }
    }
}
