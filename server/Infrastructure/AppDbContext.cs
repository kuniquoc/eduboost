using EduBoost.API.Infrastructure.Entities;
using Microsoft.EntityFrameworkCore;

namespace EduBoost.API.Infrastructure;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Class> Classes => Set<Class>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<Topic> Topics => Set<Topic>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuizOption> QuizOptions => Set<QuizOption>();
    public DbSet<QuizSubmission> QuizSubmissions => Set<QuizSubmission>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Table naming convention (snake_case) ──────────────────────────────
        modelBuilder.Entity<User>().ToTable("users");
        modelBuilder.Entity<Class>().ToTable("classes");
        modelBuilder.Entity<Enrollment>().ToTable("enrollments");
        modelBuilder.Entity<Topic>().ToTable("topics");
        modelBuilder.Entity<Document>().ToTable("documents");
        modelBuilder.Entity<Quiz>().ToTable("quizzes");
        modelBuilder.Entity<Question>().ToTable("questions");
        modelBuilder.Entity<QuizOption>().ToTable("quiz_options");
        modelBuilder.Entity<QuizSubmission>().ToTable("quiz_submissions");
        modelBuilder.Entity<RefreshToken>().ToTable("refresh_tokens");

        // ── Unique constraints ────────────────────────────────────────────────
        modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
        modelBuilder.Entity<Class>().HasIndex(c => c.ClassCode).IsUnique();
        modelBuilder.Entity<RefreshToken>().HasIndex(r => r.Token).IsUnique();

        // ── Enrollment unique (student can only join a class once) ────────────
        modelBuilder.Entity<Enrollment>()
            .HasIndex(e => new { e.StudentId, e.ClassId })
            .IsUnique();

        // ── Relationships ─────────────────────────────────────────────────────
        modelBuilder.Entity<Class>()
            .HasOne(c => c.Teacher)
            .WithMany(u => u.TaughtClasses)
            .HasForeignKey(c => c.TeacherId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Enrollment>()
            .HasOne(e => e.Student)
            .WithMany(u => u.Enrollments)
            .HasForeignKey(e => e.StudentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Enrollment>()
            .HasOne(e => e.Class)
            .WithMany(c => c.Enrollments)
            .HasForeignKey(e => e.ClassId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Topic>()
            .HasOne(t => t.Class)
            .WithMany(c => c.Topics)
            .HasForeignKey(t => t.ClassId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Document>()
            .HasOne(d => d.Owner)
            .WithMany(u => u.Documents)
            .HasForeignKey(d => d.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Document>()
            .HasOne(d => d.Class)
            .WithMany(c => c.Documents)
            .HasForeignKey(d => d.ClassId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Document>()
            .HasOne(d => d.Topic)
            .WithMany(t => t.Documents)
            .HasForeignKey(d => d.TopicId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Document>()
            .HasOne(d => d.GeneratedQuiz)
            .WithMany(q => q.GeneratedFromDocuments)
            .HasForeignKey(d => d.GeneratedQuizId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Quiz>()
            .HasOne(q => q.Class)
            .WithMany(c => c.Quizzes)
            .HasForeignKey(q => q.ClassId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Quiz>()
            .HasOne(q => q.Topic)
            .WithMany(t => t.Quizzes)
            .HasForeignKey(q => q.TopicId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Question>()
            .HasOne(q => q.Quiz)
            .WithMany(qz => qz.Questions)
            .HasForeignKey(q => q.QuizId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<QuizOption>()
            .HasOne(o => o.Question)
            .WithMany(q => q.Options)
            .HasForeignKey(o => o.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<QuizSubmission>()
            .HasOne(s => s.Student)
            .WithMany(u => u.QuizSubmissions)
            .HasForeignKey(s => s.StudentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<QuizSubmission>()
            .HasOne(s => s.Quiz)
            .WithMany(q => q.Submissions)
            .HasForeignKey(s => s.QuizId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<RefreshToken>()
            .HasOne(r => r.User)
            .WithMany(u => u.RefreshTokens)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

    }
}
