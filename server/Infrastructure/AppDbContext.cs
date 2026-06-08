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
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<LearningSession> LearningSessions => Set<LearningSession>();
    public DbSet<PlacementTestResult> PlacementTestResults => Set<PlacementTestResult>();
    public DbSet<PlacementTestSession> PlacementTestSessions => Set<PlacementTestSession>();
    public DbSet<PracticeActiveSession> PracticeActiveSessions => Set<PracticeActiveSession>();
    public DbSet<PersonalizedLearningPath> PersonalizedLearningPaths => Set<PersonalizedLearningPath>();
    public DbSet<BktState> BktStates => Set<BktState>();
    public DbSet<SpacedRepetitionItem> SpacedRepetitionItems => Set<SpacedRepetitionItem>();
    public DbSet<ConversationMessage> ConversationMessages => Set<ConversationMessage>();

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
        modelBuilder.Entity<UserProfile>().ToTable("user_profiles");
        modelBuilder.Entity<LearningSession>().ToTable("learning_sessions");
        modelBuilder.Entity<PlacementTestResult>().ToTable("placement_test_results");
        modelBuilder.Entity<PlacementTestSession>().ToTable("placement_test_sessions");
        modelBuilder.Entity<PracticeActiveSession>().ToTable("practice_active_sessions");
        modelBuilder.Entity<PersonalizedLearningPath>().ToTable("personalized_learning_paths");
        modelBuilder.Entity<BktState>().ToTable("bkt_states");
        modelBuilder.Entity<SpacedRepetitionItem>().ToTable("spaced_repetition_items");
        modelBuilder.Entity<ConversationMessage>().ToTable("conversation_messages");

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
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);

        modelBuilder.Entity<Topic>()
            .HasOne(t => t.Owner)
            .WithMany()
            .HasForeignKey(t => t.OwnerId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);

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

        modelBuilder.Entity<Quiz>()
            .HasOne(q => q.Owner)
            .WithMany()
            .HasForeignKey(q => q.OwnerId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);

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

        // ── New entity relationships ──────────────────────────────────────────

        // UserProfile (1:1 with User)
        modelBuilder.Entity<UserProfile>()
            .HasOne(p => p.User)
            .WithOne(u => u.Profile)
            .HasForeignKey<UserProfile>(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserProfile>()
            .HasIndex(p => p.UserId)
            .IsUnique();

        // LearningSession
        modelBuilder.Entity<LearningSession>()
            .HasOne(ls => ls.User)
            .WithMany(u => u.LearningSessions)
            .HasForeignKey(ls => ls.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<LearningSession>()
            .HasOne(ls => ls.Topic)
            .WithMany()
            .HasForeignKey(ls => ls.TopicId)
            .OnDelete(DeleteBehavior.Cascade);

        // PlacementTestResult
        modelBuilder.Entity<PlacementTestResult>()
            .HasOne(p => p.User)
            .WithMany(u => u.PlacementTestResults)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PlacementTestSession>()
            .HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PlacementTestSession>()
            .HasIndex(s => new { s.UserId, s.ClassId });

        modelBuilder.Entity<PracticeActiveSession>()
            .HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // PersonalizedLearningPath
        modelBuilder.Entity<PersonalizedLearningPath>()
            .HasOne(lp => lp.User)
            .WithMany(u => u.LearningPaths)
            .HasForeignKey(lp => lp.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PersonalizedLearningPath>()
            .HasOne(lp => lp.Topic)
            .WithMany()
            .HasForeignKey(lp => lp.TopicId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PersonalizedLearningPath>()
            .HasIndex(lp => new { lp.UserId, lp.TopicId })
            .IsUnique();

        // BktState (unique per user+topic)
        modelBuilder.Entity<BktState>()
            .HasOne(b => b.User)
            .WithMany(u => u.BktStates)
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BktState>()
            .HasOne(b => b.Topic)
            .WithMany()
            .HasForeignKey(b => b.TopicId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<BktState>()
            .HasIndex(b => new { b.UserId, b.TopicId })
            .IsUnique();

        // SpacedRepetitionItem
        modelBuilder.Entity<SpacedRepetitionItem>()
            .HasOne(sr => sr.User)
            .WithMany(u => u.SpacedRepetitionItems)
            .HasForeignKey(sr => sr.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SpacedRepetitionItem>()
            .HasOne(sr => sr.Question)
            .WithMany(q => q.SpacedRepetitionItems)
            .HasForeignKey(sr => sr.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SpacedRepetitionItem>()
            .HasOne(sr => sr.Topic)
            .WithMany()
            .HasForeignKey(sr => sr.TopicId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SpacedRepetitionItem>()
            .HasIndex(sr => new { sr.UserId, sr.QuestionId })
            .IsUnique();

        modelBuilder.Entity<SpacedRepetitionItem>()
            .HasIndex(sr => sr.NextReviewDate);

        // ConversationMessage
        modelBuilder.Entity<ConversationMessage>()
            .HasOne(cm => cm.User)
            .WithMany(u => u.ConversationMessages)
            .HasForeignKey(cm => cm.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ConversationMessage>()
            .HasOne(cm => cm.Topic)
            .WithMany()
            .HasForeignKey(cm => cm.TopicId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<ConversationMessage>()
            .HasIndex(cm => new { cm.UserId, cm.TopicId, cm.CreatedAt });

        // Question -> SourceDocument
        modelBuilder.Entity<Question>()
            .HasOne(q => q.SourceDocument)
            .WithMany()
            .HasForeignKey(q => q.SourceDocumentId)
            .OnDelete(DeleteBehavior.SetNull);

    }
}
