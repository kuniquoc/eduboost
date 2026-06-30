using EduBoost.API.Infrastructure.Entities;
using EduBoost.API.Common.Learning;
using EduBoost.API.Infrastructure.Integrations.Storage;
using Microsoft.EntityFrameworkCore;
using System.IO;

namespace EduBoost.API.Infrastructure;

/// <summary>
/// Seed sample data into DB after migrations have run.
/// Idempotent: checks each table before inserting to avoid duplicates.
/// </summary>
public static class DatabaseSeeder
{
    private static readonly DateTime SeedDate = new(2024, 1, 15, 0, 0, 0, DateTimeKind.Utc);

    // BCrypt hash of "password123" (cost=11) — precomputed to avoid overhead when seeding
    private const string SeedPassword = "password123";
    private static readonly string SeedPasswordHash = BCrypt.Net.BCrypt.HashPassword(SeedPassword, 11);

    private static IrtItem SeedIrtItem(string band)
    {
        var beta = IrtScale.PriorFromBand(band);
        return new IrtItem
        {
            Id = Guid.NewGuid(),
            InitialBeta = beta,
            Beta = beta,
            PriorSource = "seed",
            CalibrationStatus = "provisional"
        };
    }

    // ── Fixed IDs ─────────────────────────────────────────────────────────────
    private static readonly Guid A1 = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private static readonly Guid T1 = Guid.Parse("11111111-0000-0000-0000-000000000001");
    private static readonly Guid S1 = Guid.Parse("22222222-0000-0000-0000-000000000001");
    private static readonly Guid S2 = Guid.Parse("22222222-0000-0000-0000-000000000002");
    private static readonly Guid S3 = Guid.Parse("22222222-0000-0000-0000-000000000003");

    private static readonly Guid Cls1 = Guid.Parse("33333333-0000-0000-0000-000000000001");

    private static readonly Guid Enr1 = Guid.Parse("77777777-0000-0000-0000-000000000001");
    private static readonly Guid Enr2 = Guid.Parse("77777777-0000-0000-0000-000000000002");
    private static readonly Guid Enr3 = Guid.Parse("77777777-0000-0000-0000-000000000003");

    private static readonly Guid Tp1 = Guid.Parse("44444444-0000-0000-0000-000000000001");
    private static readonly Guid Tp2 = Guid.Parse("44444444-0000-0000-0000-000000000002");
    private static readonly Guid Tp3 = Guid.Parse("44444444-0000-0000-0000-000000000003");
    private static readonly Guid Tp4 = Guid.Parse("44444444-0000-0000-0000-000000000004");
    private static readonly Guid Tp5 = Guid.Parse("44444444-0000-0000-0000-000000000005");

    private static readonly Guid Q1 = Guid.Parse("55555555-0000-0000-0000-000000000001");
    private static readonly Guid Q2 = Guid.Parse("55555555-0000-0000-0000-000000000002");
    private static readonly Guid Q3 = Guid.Parse("55555555-0000-0000-0000-000000000003");

    private static readonly Guid Doc1 = Guid.Parse("66666666-0000-0000-0000-000000000001");
    private static readonly Guid Doc2 = Guid.Parse("66666666-0000-0000-0000-000000000002");
    private static readonly Guid Doc3 = Guid.Parse("66666666-0000-0000-0000-000000000003");
    private static readonly Guid Doc4 = Guid.Parse("66666666-0000-0000-0000-000000000004");
    private static readonly Guid Doc5 = Guid.Parse("66666666-0000-0000-0000-000000000005");

    // ── Entry point ───────────────────────────────────────────────────────────
    public static async Task SeedAsync(AppDbContext db, IStorageService storageService, ILogger logger)
    {
        // Only seed when DB is empty (check users table)
        if (await db.Users.AnyAsync())
        {
            logger.LogInformation("Seed data already exists, skipping.");
            return;
        }

        logger.LogInformation("Seeding initial data...");

        await SeedUsersAsync(db);
        await SeedClassesAsync(db);
        await SeedEnrollmentsAsync(db);
        await SeedTopicsAsync(db);
        await SeedQuizzesAsync(db);
        await SeedQuizQuestionsAsync(db);
        await SeedDocumentsAsync(db, storageService, logger);

        logger.LogInformation("Seed data inserted successfully.");
    }

    // ── Users ─────────────────────────────────────────────────────────────────
    private static async Task SeedUsersAsync(AppDbContext db)
    {
        db.Users.AddRange(
            new User { Id = A1, Name = "Admin EduBoost", Email = "admin@eduboost.vn", PasswordHash = SeedPasswordHash, Role = "admin", AvatarInitials = "AE", CreatedAt = SeedDate },
            new User { Id = T1, Name = "Nguyễn Thành An", Email = "teacher@eduboost.vn", PasswordHash = SeedPasswordHash, Role = "teacher", AvatarInitials = "TA", CreatedAt = SeedDate },
            new User { Id = S1, Name = "Lê Thị Bảo", Email = "student@eduboost.vn", PasswordHash = SeedPasswordHash, Role = "student", AvatarInitials = "LB", CreatedAt = SeedDate },
            new User { Id = S2, Name = "Phạm Quốc Đạt", Email = "dat@eduboost.vn", PasswordHash = SeedPasswordHash, Role = "student", AvatarInitials = "PD", CreatedAt = SeedDate },
            new User { Id = S3, Name = "Hoàng Thu Hà", Email = "ha@eduboost.vn", PasswordHash = SeedPasswordHash, Role = "student", AvatarInitials = "HH", CreatedAt = SeedDate }
        );
        await db.SaveChangesAsync();
    }

    // ── Classes ───────────────────────────────────────────────────────────────
    private static async Task SeedClassesAsync(AppDbContext db)
    {
        db.Classes.AddRange(
            new Class { Id = Cls1, Name = "English Grammar Mastery", TeacherId = T1, Description = "Master English grammar from basics to advanced structures", CoverColor = "#6366F1", ClassCode = "ENG2026", CreatedAt = SeedDate }
        );
        await db.SaveChangesAsync();
    }

    // ── Enrollments ───────────────────────────────────────────────────────────
    private static async Task SeedEnrollmentsAsync(AppDbContext db)
    {
        db.Enrollments.AddRange(
            new Enrollment { Id = Enr1, StudentId = S1, ClassId = Cls1, EnrolledAt = SeedDate.AddDays(5), EntryTestCompleted = true, Progress = 72 },
            new Enrollment { Id = Enr2, StudentId = S2, ClassId = Cls1, EnrolledAt = SeedDate.AddDays(7), EntryTestCompleted = true, Progress = 45 },
            new Enrollment { Id = Enr3, StudentId = S3, ClassId = Cls1, EnrolledAt = SeedDate.AddDays(10), EntryTestCompleted = false, Progress = 10 }
        );
        await db.SaveChangesAsync();
    }

    // ── Topics ────────────────────────────────────────────────────────────────
    private static async Task SeedTopicsAsync(AppDbContext db)
    {
        db.Topics.AddRange(
            // English Grammar Mastery
            new Topic { Id = Tp1, ClassId = Cls1, Name = "Present Simple vs Continuous", Description = "Usage, form, and signal words for present tenses", Difficulty = "easy", AiEvaluated = true, IsDocumentVisible = true, CreatedAt = SeedDate.AddDays(1) },
            new Topic { Id = Tp2, ClassId = Cls1, Name = "Past Simple vs Present Perfect", Description = "Distinguishing completed past from present relevance", Difficulty = "medium", AiEvaluated = true, IsDocumentVisible = true, CreatedAt = SeedDate.AddDays(2) },
            new Topic { Id = Tp3, ClassId = Cls1, Name = "Conditional Sentences", Description = "Zero, first, second, and third conditionals", Difficulty = "hard", AiEvaluated = true, IsDocumentVisible = true, CreatedAt = SeedDate.AddDays(3) },
            new Topic { Id = Tp4, ClassId = Cls1, Name = "Relative Clauses", Description = "Defining and non-defining relative clauses with who, which, that", Difficulty = "medium", AiEvaluated = true, IsDocumentVisible = true, CreatedAt = SeedDate.AddDays(4) },
            new Topic { Id = Tp5, ClassId = Cls1, Name = "Passive Voice", Description = "Active to passive transformation across tenses", Difficulty = "medium", AiEvaluated = true, IsDocumentVisible = true, CreatedAt = SeedDate.AddDays(5) }
        );
        await db.SaveChangesAsync();
    }

    // ── Quizzes ───────────────────────────────────────────────────────────────
    private static async Task SeedQuizzesAsync(AppDbContext db)
    {
        db.Quizzes.AddRange(
            new Quiz { Id = Q1, ClassId = Cls1, TopicId = Tp1, Title = "Present Simple vs Continuous Quiz", Type = "practice", IsPublished = true, CreatedAt = SeedDate.AddDays(10) },
            new Quiz { Id = Q2, ClassId = Cls1, TopicId = Tp2, Title = "Past Tenses Quiz", Type = "practice", IsPublished = true, CreatedAt = SeedDate.AddDays(11) },
            new Quiz { Id = Q3, ClassId = Cls1, TopicId = null, Title = "English Grammar Entry Test", Type = "entry_test", IsPublished = true, CreatedAt = SeedDate.AddDays(22) }
        );
        await db.SaveChangesAsync();
    }

    // ── Quiz Questions ────────────────────────────────────────────────────────
    private static async Task SeedQuizQuestionsAsync(AppDbContext db)
    {
        // ── Q1: Present Simple vs Continuous Quiz — 5 questions ──────────────
        db.Questions.AddRange(
            new Question
            {
                Id = Guid.NewGuid(),
                QuizId = Q1,
                Text = "Which sentence is correct?",
                Type = "mcq",
                IrtItem = SeedIrtItem("easy"),
                Explanation = "'Know' is a stative verb and is not used in the continuous form.",
                VerifiedByTeacher = true,
                OrderIndex = 0,
                Options =
                [
                    new QuizOption { Id = Guid.NewGuid(), Text = "She is knowing the answer.",  IsCorrect = false, OrderIndex = 0 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "She knows the answer.",       IsCorrect = true,  OrderIndex = 1 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "She know the answer.",        IsCorrect = false, OrderIndex = 2 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "She are knowing the answer.", IsCorrect = false, OrderIndex = 3 },
                ]
            },
            new Question
            {
                Id = Guid.NewGuid(),
                QuizId = Q1,
                Text = "Choose the correct form: 'Look! The children _____ in the garden.'",
                Type = "mcq",
                IrtItem = SeedIrtItem("easy"),
                Explanation = "We use the present continuous for actions happening right now, indicated by 'Look!'",
                VerifiedByTeacher = true,
                OrderIndex = 1,
                Options =
                [
                    new QuizOption { Id = Guid.NewGuid(), Text = "play",        IsCorrect = false, OrderIndex = 0 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "plays",       IsCorrect = false, OrderIndex = 1 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "are playing", IsCorrect = true,  OrderIndex = 2 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "is playing",  IsCorrect = false, OrderIndex = 3 },
                ]
            },
            new Question
            {
                Id = Guid.NewGuid(),
                QuizId = Q1,
                Text = "Which signal word indicates Present Simple?",
                Type = "mcq",
                IrtItem = SeedIrtItem("easy"),
                Explanation = "'Every day' indicates a routine/habit, which requires Present Simple.",
                VerifiedByTeacher = true,
                OrderIndex = 2,
                Options =
                [
                    new QuizOption { Id = Guid.NewGuid(), Text = "right now",      IsCorrect = false, OrderIndex = 0 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "at the moment",  IsCorrect = false, OrderIndex = 1 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "every day",      IsCorrect = true,  OrderIndex = 2 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "currently",      IsCorrect = false, OrderIndex = 3 },
                ]
            },
            new Question
            {
                Id = Guid.NewGuid(),
                QuizId = Q1,
                Text = "Select the correct sentence:",
                Type = "mcq",
                IrtItem = SeedIrtItem("medium"),
                Explanation = "Habitual actions with 'usually' require Present Simple, not Present Continuous.",
                VerifiedByTeacher = true,
                OrderIndex = 3,
                Options =
                [
                    new QuizOption { Id = Guid.NewGuid(), Text = "I am usually getting up at 7 AM.", IsCorrect = false, OrderIndex = 0 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "I usually get up at 7 AM.",        IsCorrect = true,  OrderIndex = 1 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "I usually getting up at 7 AM.",    IsCorrect = false, OrderIndex = 2 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "I am usually get up at 7 AM.",     IsCorrect = false, OrderIndex = 3 },
                ]
            },
            new Question
            {
                Id = Guid.NewGuid(),
                QuizId = Q1,
                Text = "'The train _____ at 9:00 tomorrow.' Choose the best answer.",
                Type = "mcq",
                IrtItem = SeedIrtItem("medium"),
                Explanation = "Present Simple is used for scheduled/timetabled events even when referring to the future.",
                VerifiedByTeacher = true,
                OrderIndex = 4,
                Options =
                [
                    new QuizOption { Id = Guid.NewGuid(), Text = "is leaving",   IsCorrect = false, OrderIndex = 0 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "leaves",       IsCorrect = true,  OrderIndex = 1 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "will leaving", IsCorrect = false, OrderIndex = 2 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "leave",        IsCorrect = false, OrderIndex = 3 },
                ]
            }
        );

        // ── Q3: English Grammar Entry Test — 6 questions ─────────────────────
        db.Questions.AddRange(
            // 1. Present Simple (easy)
            new Question
            {
                Id = Guid.NewGuid(),
                QuizId = Q3,
                Text = "She _____ to school every morning.",
                Type = "mcq",
                IrtItem = SeedIrtItem("easy"),
                Explanation = "For routines and habits we use Present Simple. Third person singular requires 'goes'.",
                VerifiedByTeacher = true,
                OrderIndex = 0,
                Options =
                [
                    new QuizOption { Id = Guid.NewGuid(), Text = "goes",      IsCorrect = true,  OrderIndex = 0 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "go",        IsCorrect = false, OrderIndex = 1 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "is going",  IsCorrect = false, OrderIndex = 2 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "going",     IsCorrect = false, OrderIndex = 3 },
                ]
            },
            // 2. Present Continuous (easy)
            new Question
            {
                Id = Guid.NewGuid(),
                QuizId = Q3,
                Text = "Be quiet! The baby _____ right now.",
                Type = "mcq",
                IrtItem = SeedIrtItem("easy"),
                Explanation = "We use Present Continuous for actions happening at the moment of speaking. 'Right now' is the signal.",
                VerifiedByTeacher = true,
                OrderIndex = 1,
                Options =
                [
                    new QuizOption { Id = Guid.NewGuid(), Text = "sleeps",      IsCorrect = false, OrderIndex = 0 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "is sleeping", IsCorrect = true,  OrderIndex = 1 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "sleep",       IsCorrect = false, OrderIndex = 2 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "slept",       IsCorrect = false, OrderIndex = 3 },
                ]
            },
            // 3. Past Simple (medium)
            new Question
            {
                Id = Guid.NewGuid(),
                QuizId = Q3,
                Text = "They _____ to Paris last summer.",
                Type = "mcq",
                IrtItem = SeedIrtItem("medium"),
                Explanation = "Past Simple is used for completed actions at a specific time in the past. 'Last summer' signals Past Simple.",
                VerifiedByTeacher = true,
                OrderIndex = 2,
                Options =
                [
                    new QuizOption { Id = Guid.NewGuid(), Text = "have traveled", IsCorrect = false, OrderIndex = 0 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "traveled",      IsCorrect = true,  OrderIndex = 1 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "are traveling",  IsCorrect = false, OrderIndex = 2 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "will travel",   IsCorrect = false, OrderIndex = 3 },
                ]
            },
            // 4. Present Perfect (medium)
            new Question
            {
                Id = Guid.NewGuid(),
                QuizId = Q3,
                Text = "I _____ this book three times so far.",
                Type = "mcq",
                IrtItem = SeedIrtItem("medium"),
                Explanation = "Present Perfect is used for experiences up to the present. 'So far' signals Present Perfect.",
                VerifiedByTeacher = true,
                OrderIndex = 3,
                Options =
                [
                    new QuizOption { Id = Guid.NewGuid(), Text = "read",        IsCorrect = false, OrderIndex = 0 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "have read",   IsCorrect = true,  OrderIndex = 1 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "am reading",  IsCorrect = false, OrderIndex = 2 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "was reading", IsCorrect = false, OrderIndex = 3 },
                ]
            },
            // 5. Conditional Type 1 (medium)
            new Question
            {
                Id = Guid.NewGuid(),
                QuizId = Q3,
                Text = "If it _____ tomorrow, we will cancel the picnic.",
                Type = "mcq",
                IrtItem = SeedIrtItem("medium"),
                Explanation = "First conditional uses 'if + Present Simple, will + base form' for real/possible future situations.",
                VerifiedByTeacher = true,
                OrderIndex = 4,
                Options =
                [
                    new QuizOption { Id = Guid.NewGuid(), Text = "will rain",  IsCorrect = false, OrderIndex = 0 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "rains",      IsCorrect = true,  OrderIndex = 1 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "rained",     IsCorrect = false, OrderIndex = 2 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "would rain", IsCorrect = false, OrderIndex = 3 },
                ]
            },
            // 6. Passive Voice (hard)
            new Question
            {
                Id = Guid.NewGuid(),
                QuizId = Q3,
                Text = "The report _____ by the manager yesterday.",
                Type = "mcq",
                IrtItem = SeedIrtItem("hard"),
                Explanation = "Past Simple Passive is formed with 'was/were + past participle'. Since 'report' is singular, we use 'was approved'.",
                VerifiedByTeacher = true,
                OrderIndex = 5,
                Options =
                [
                    new QuizOption { Id = Guid.NewGuid(), Text = "approved",      IsCorrect = false, OrderIndex = 0 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "was approved",   IsCorrect = true,  OrderIndex = 1 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "is approved",    IsCorrect = false, OrderIndex = 2 },
                    new QuizOption { Id = Guid.NewGuid(), Text = "has approved",   IsCorrect = false, OrderIndex = 3 },
                ]
            }
        );

        await db.SaveChangesAsync();
    }

    // ── Documents ─────────────────────────────────────────────────────────────
    private static async Task SeedDocumentsAsync(AppDbContext db, IStorageService storage, ILogger logger)
    {
        db.Documents.AddRange(
            new Document { Id = Doc1, OwnerId = T1, ClassId = Cls1, TopicId = Tp1, GeneratedQuizId = Q1, FileName = "present_simple_vs_continuous.txt", FileSize = "7.5 KB", StorageKey = "class/cls1/present_simple_vs_continuous.txt", Status = "ready", Scope = "class", UploadedAt = SeedDate.AddDays(25) },
            new Document { Id = Doc2, OwnerId = T1, ClassId = Cls1, TopicId = Tp2, GeneratedQuizId = Q2, FileName = "past_simple_vs_present_perfect.txt", FileSize = "8.6 KB", StorageKey = "class/cls1/past_simple_vs_present_perfect.txt", Status = "ready", Scope = "class", UploadedAt = SeedDate.AddDays(27) },
            new Document { Id = Doc3, OwnerId = T1, ClassId = Cls1, TopicId = Tp3, GeneratedQuizId = null, FileName = "conditional_sentences.txt", FileSize = "8.0 KB", StorageKey = "class/cls1/conditional_sentences.txt", Status = "ready", Scope = "class", UploadedAt = SeedDate.AddDays(30) },
            new Document { Id = Doc4, OwnerId = T1, ClassId = Cls1, TopicId = Tp4, GeneratedQuizId = null, FileName = "relative_clauses.txt", FileSize = "8.5 KB", StorageKey = "class/cls1/relative_clauses.txt", Status = "ready", Scope = "class", UploadedAt = SeedDate.AddDays(32) },
            new Document { Id = Doc5, OwnerId = T1, ClassId = Cls1, TopicId = Tp5, GeneratedQuizId = null, FileName = "passive_voice.txt", FileSize = "9.9 KB", StorageKey = "class/cls1/passive_voice.txt", Status = "ready", Scope = "class", UploadedAt = SeedDate.AddDays(35) }
        );
        await db.SaveChangesAsync();

        // Physically upload files to MinIO storage during seed process for 100% correct setup
        await UploadFileToMinioAsync(storage, "present_simple_vs_continuous.txt", "class/cls1/present_simple_vs_continuous.txt", logger);
        await UploadFileToMinioAsync(storage, "past_simple_vs_present_perfect.txt", "class/cls1/past_simple_vs_present_perfect.txt", logger);
        await UploadFileToMinioAsync(storage, "conditional_sentences.txt", "class/cls1/conditional_sentences.txt", logger);
        await UploadFileToMinioAsync(storage, "relative_clauses.txt", "class/cls1/relative_clauses.txt", logger);
        await UploadFileToMinioAsync(storage, "passive_voice.txt", "class/cls1/passive_voice.txt", logger);
    }

    private static async Task UploadFileToMinioAsync(IStorageService storage, string fileName, string storageKey, ILogger logger)
    {
        try
        {
            // Try to resolve path dynamically relative to AppContext.BaseDirectory or Directory.GetCurrentDirectory()
            var possiblePaths = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "../../../../ai-agent-core/data/raw", fileName),
                Path.Combine(Directory.GetCurrentDirectory(), "../ai-agent-core/data/raw", fileName),
                Path.Combine(Directory.GetCurrentDirectory(), "ai-agent-core/data/raw", fileName)
            };

            string? finalPath = null;
            foreach (var path in possiblePaths)
            {
                if (File.Exists(path))
                {
                    finalPath = path;
                    break;
                }
            }

            byte[] fileBytes;
            if (finalPath != null)
            {
                fileBytes = await File.ReadAllBytesAsync(finalPath);
                logger.LogInformation("Read original textbook data for {FileName} successfully.", fileName);
            }
            else
            {
                throw new FileNotFoundException(
                    $"Seed source file not found for {fileName}. Checked paths: {string.Join(", ", possiblePaths)}"
                );
            }

            using var memoryStream = new MemoryStream(fileBytes);
            // MinioStorageService.Buckets.ClassDocuments is "eduboost-class-docs"
            await storage.UploadObjectAsync("eduboost-class-docs", storageKey, memoryStream, "text/plain");
            logger.LogInformation("Physically uploaded seeded document {FileName} into MinIO storage key '{Key}' successfully.", fileName, storageKey);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred while uploading file {FileName} to MinIO during seeding.", fileName);
            throw;
        }
    }
}
