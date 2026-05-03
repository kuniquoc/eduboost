using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Infrastructure;

/// <summary>
/// Seed dữ liệu mẫu vào DB sau khi migration đã chạy xong.
/// Idempotent: kiểm tra từng bảng trước khi insert để tránh trùng lặp.
/// </summary>
public static class DatabaseSeeder
{
    private static readonly DateTime SeedDate = new(2024, 1, 15, 0, 0, 0, DateTimeKind.Utc);

    // BCrypt hash của "password123" (cost=11) — tính sẵn để tránh overhead khi seed
    private const string SeedPassword = "password123";
    private static readonly string SeedPasswordHash = BCrypt.Net.BCrypt.HashPassword(SeedPassword, 11);

    // ── Fixed IDs ─────────────────────────────────────────────────────────────
    private static readonly Guid T1  = Guid.Parse("11111111-0000-0000-0000-000000000001");
    private static readonly Guid T2  = Guid.Parse("11111111-0000-0000-0000-000000000002");
    private static readonly Guid S1  = Guid.Parse("22222222-0000-0000-0000-000000000001");
    private static readonly Guid S2  = Guid.Parse("22222222-0000-0000-0000-000000000002");
    private static readonly Guid S3  = Guid.Parse("22222222-0000-0000-0000-000000000003");

    private static readonly Guid Cls1 = Guid.Parse("33333333-0000-0000-0000-000000000001");
    private static readonly Guid Cls2 = Guid.Parse("33333333-0000-0000-0000-000000000002");
    private static readonly Guid Cls3 = Guid.Parse("33333333-0000-0000-0000-000000000003");

    private static readonly Guid Enr1 = Guid.Parse("77777777-0000-0000-0000-000000000001");
    private static readonly Guid Enr2 = Guid.Parse("77777777-0000-0000-0000-000000000002");
    private static readonly Guid Enr3 = Guid.Parse("77777777-0000-0000-0000-000000000003");
    private static readonly Guid Enr4 = Guid.Parse("77777777-0000-0000-0000-000000000004");

    private static readonly Guid Tp1  = Guid.Parse("44444444-0000-0000-0000-000000000001");
    private static readonly Guid Tp2  = Guid.Parse("44444444-0000-0000-0000-000000000002");
    private static readonly Guid Tp3  = Guid.Parse("44444444-0000-0000-0000-000000000003");
    private static readonly Guid Tp4  = Guid.Parse("44444444-0000-0000-0000-000000000004");
    private static readonly Guid Tp5  = Guid.Parse("44444444-0000-0000-0000-000000000005");
    private static readonly Guid Tp6  = Guid.Parse("44444444-0000-0000-0000-000000000006");
    private static readonly Guid Tp7  = Guid.Parse("44444444-0000-0000-0000-000000000007");
    private static readonly Guid Tp8  = Guid.Parse("44444444-0000-0000-0000-000000000008");
    private static readonly Guid Tp9  = Guid.Parse("44444444-0000-0000-0000-000000000009");
    private static readonly Guid Tp10 = Guid.Parse("44444444-0000-0000-0000-000000000010");
    private static readonly Guid Tp11 = Guid.Parse("44444444-0000-0000-0000-000000000011");
    private static readonly Guid Tp12 = Guid.Parse("44444444-0000-0000-0000-000000000012");

    private static readonly Guid Q1   = Guid.Parse("55555555-0000-0000-0000-000000000001");
    private static readonly Guid Q2   = Guid.Parse("55555555-0000-0000-0000-000000000002");
    private static readonly Guid Q3   = Guid.Parse("55555555-0000-0000-0000-000000000003");

    private static readonly Guid Doc1 = Guid.Parse("66666666-0000-0000-0000-000000000001");
    private static readonly Guid Doc2 = Guid.Parse("66666666-0000-0000-0000-000000000002");
    private static readonly Guid Doc3 = Guid.Parse("66666666-0000-0000-0000-000000000003");

    // ── Entry point ───────────────────────────────────────────────────────────
    public static async Task SeedAsync(AppDbContext db, ILogger logger)
    {
        // Chỉ seed khi DB trống (kiểm tra bảng users)
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
        await SeedDocumentsAsync(db);

        logger.LogInformation("Seed data inserted successfully.");
    }

    // ── Users ─────────────────────────────────────────────────────────────────
    private static async Task SeedUsersAsync(AppDbContext db)
    {
        db.Users.AddRange(
            new User { Id = T1, Name = "Nguyễn Thành An",  Email = "teacher@eduboost.vn", PasswordHash = SeedPasswordHash, Role = "teacher", AvatarInitials = "TA", CreatedAt = SeedDate },
            new User { Id = T2, Name = "Trần Minh Khoa",   Email = "khoa@eduboost.vn",    PasswordHash = SeedPasswordHash, Role = "teacher", AvatarInitials = "TK", CreatedAt = SeedDate },
            new User { Id = S1, Name = "Lê Thị Bảo",       Email = "student@eduboost.vn", PasswordHash = SeedPasswordHash, Role = "student", AvatarInitials = "LB", CreatedAt = SeedDate },
            new User { Id = S2, Name = "Phạm Quốc Đạt",    Email = "dat@eduboost.vn",     PasswordHash = SeedPasswordHash, Role = "student", AvatarInitials = "PD", CreatedAt = SeedDate },
            new User { Id = S3, Name = "Hoàng Thu Hà",      Email = "ha@eduboost.vn",      PasswordHash = SeedPasswordHash, Role = "student", AvatarInitials = "HH", CreatedAt = SeedDate }
        );
        await db.SaveChangesAsync();
    }

    // ── Classes ───────────────────────────────────────────────────────────────
    private static async Task SeedClassesAsync(AppDbContext db)
    {
        db.Classes.AddRange(
            new Class { Id = Cls1, Name = "Advanced Mathematics",  TeacherId = T1, Description = "Calculus, Linear Algebra & Statistics",           CoverColor = "#6366F1", ClassCode = "MATH2024", CreatedAt = SeedDate },
            new Class { Id = Cls2, Name = "Physics Fundamentals",  TeacherId = T1, Description = "Mechanics, Thermodynamics & Electromagnetism",      CoverColor = "#06B6D4", ClassCode = "PHY2024",  CreatedAt = SeedDate.AddDays(17) },
            new Class { Id = Cls3, Name = "Computer Science 101",  TeacherId = T2, Description = "Algorithms, Data Structures & OOP",                CoverColor = "#10B981", ClassCode = "CS2024",   CreatedAt = SeedDate.AddDays(54) }
        );
        await db.SaveChangesAsync();
    }

    // ── Enrollments ───────────────────────────────────────────────────────────
    private static async Task SeedEnrollmentsAsync(AppDbContext db)
    {
        db.Enrollments.AddRange(
            new Enrollment { Id = Enr1, StudentId = S1, ClassId = Cls1, EnrolledAt = SeedDate.AddDays(5),  EntryTestCompleted = true,  Progress = 72 },
            new Enrollment { Id = Enr2, StudentId = S2, ClassId = Cls1, EnrolledAt = SeedDate.AddDays(7),  EntryTestCompleted = true,  Progress = 45 },
            new Enrollment { Id = Enr3, StudentId = S3, ClassId = Cls1, EnrolledAt = SeedDate.AddDays(10), EntryTestCompleted = false, Progress = 10 },
            new Enrollment { Id = Enr4, StudentId = S1, ClassId = Cls2, EnrolledAt = SeedDate.AddDays(21), EntryTestCompleted = true,  Progress = 38 }
        );
        await db.SaveChangesAsync();
    }

    // ── Topics ────────────────────────────────────────────────────────────────
    private static async Task SeedTopicsAsync(AppDbContext db)
    {
        db.Topics.AddRange(
            // Mathematics
            new Topic { Id = Tp1,  ClassId = Cls1, Name = "Derivatives & Integrals", Description = "Differentiation and integration rules",    Difficulty = "hard",   AiEvaluated = true,  IsDocumentVisible = true,  CreatedAt = SeedDate.AddDays(1) },
            new Topic { Id = Tp2,  ClassId = Cls1, Name = "Linear Algebra",           Description = "Vectors, matrices, and transformations",   Difficulty = "medium", AiEvaluated = true,  IsDocumentVisible = true,  CreatedAt = SeedDate.AddDays(2) },
            new Topic { Id = Tp3,  ClassId = Cls1, Name = "Statistics",               Description = "Probability and statistical analysis",      Difficulty = "medium", AiEvaluated = false, IsDocumentVisible = false, CreatedAt = SeedDate.AddDays(3) },
            new Topic { Id = Tp4,  ClassId = Cls1, Name = "Trigonometry",             Description = "Trigonometric functions and identities",    Difficulty = "easy",   AiEvaluated = true,  IsDocumentVisible = true,  CreatedAt = SeedDate.AddDays(4) },
            new Topic { Id = Tp5,  ClassId = Cls1, Name = "Number Theory",            Description = "Primes, modular arithmetic",                Difficulty = "hard",   AiEvaluated = false, IsDocumentVisible = false, CreatedAt = SeedDate.AddDays(5) },
            // Physics
            new Topic { Id = Tp6,  ClassId = Cls2, Name = "Newton's Laws",            Description = "Classical mechanics fundamentals",          Difficulty = "medium", AiEvaluated = true,  IsDocumentVisible = true,  CreatedAt = SeedDate.AddDays(18) },
            new Topic { Id = Tp7,  ClassId = Cls2, Name = "Thermodynamics",           Description = "Heat, energy, and entropy",                  Difficulty = "hard",   AiEvaluated = true,  IsDocumentVisible = false, CreatedAt = SeedDate.AddDays(19) },
            new Topic { Id = Tp8,  ClassId = Cls2, Name = "Electromagnetism",         Description = "Electric and magnetic fields",              Difficulty = "hard",   AiEvaluated = false, IsDocumentVisible = true,  CreatedAt = SeedDate.AddDays(20) },
            new Topic { Id = Tp9,  ClassId = Cls2, Name = "Wave Optics",              Description = "Light waves and interference",              Difficulty = "medium", AiEvaluated = true,  IsDocumentVisible = true,  CreatedAt = SeedDate.AddDays(21) },
            // CS
            new Topic { Id = Tp10, ClassId = Cls3, Name = "Sorting Algorithms",       Description = "Bubble, merge, quick sort and more",        Difficulty = "medium", AiEvaluated = true,  IsDocumentVisible = true,  CreatedAt = SeedDate.AddDays(55) },
            new Topic { Id = Tp11, ClassId = Cls3, Name = "OOP Principles",           Description = "Classes, inheritance, polymorphism",         Difficulty = "easy",   AiEvaluated = true,  IsDocumentVisible = true,  CreatedAt = SeedDate.AddDays(56) },
            new Topic { Id = Tp12, ClassId = Cls3, Name = "Graph Theory",             Description = "BFS, DFS, shortest paths",                  Difficulty = "hard",   AiEvaluated = false, IsDocumentVisible = false, CreatedAt = SeedDate.AddDays(57) }
        );
        await db.SaveChangesAsync();
    }

    // ── Quizzes ───────────────────────────────────────────────────────────────
    private static async Task SeedQuizzesAsync(AppDbContext db)
    {
        db.Quizzes.AddRange(
            new Quiz { Id = Q1, ClassId = Cls1, TopicId = Tp1, Title = "Derivatives & Integrals Quiz", Type = "practice",   IsPublished = true, CreatedAt = SeedDate.AddDays(10) },
            new Quiz { Id = Q2, ClassId = Cls1, TopicId = Tp2, Title = "Linear Algebra Quiz",           Type = "practice",   IsPublished = true, CreatedAt = SeedDate.AddDays(11) },
            new Quiz { Id = Q3, ClassId = Cls2, TopicId = Tp6, Title = "Newton's Laws Entry Test",       Type = "entry_test", IsPublished = true, CreatedAt = SeedDate.AddDays(22) }
        );
        await db.SaveChangesAsync();
    }

    // ── Documents ─────────────────────────────────────────────────────────────
    private static async Task SeedDocumentsAsync(AppDbContext db)
    {
        db.Documents.AddRange(
            new Document { Id = Doc1, OwnerId = T1, ClassId = Cls1, TopicId = Tp1, GeneratedQuizId = Q1, FileName = "Calculus_Lecture_Notes.pdf",   FileSize = "2.4 MB", StorageKey = "class/cls1/calculus_lecture_notes.pdf",   Status = "ready", Scope = "class", UploadedAt = SeedDate.AddDays(25) },
            new Document { Id = Doc2, OwnerId = T1, ClassId = Cls1, TopicId = Tp2, GeneratedQuizId = Q2, FileName = "Linear_Algebra_Handbook.pdf",   FileSize = "5.1 MB", StorageKey = "class/cls1/linear_algebra_handbook.pdf",   Status = "ready", Scope = "class", UploadedAt = SeedDate.AddDays(27) },
            new Document { Id = Doc3, OwnerId = T1, ClassId = Cls2, TopicId = Tp6, GeneratedQuizId = Q3, FileName = "Physics_Part1.pdf",             FileSize = "3.8 MB", StorageKey = "class/cls2/physics_part1.pdf",             Status = "ready", Scope = "class", UploadedAt = SeedDate.AddDays(30) }
        );
        await db.SaveChangesAsync();
    }
}
