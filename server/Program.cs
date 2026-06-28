using System.Text;
using EduBoost.API.Infrastructure;
using EduBoost.API.Infrastructure.Integrations.Storage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpLogging;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ── Controllers ──────────────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        // Đảm bảo camelCase nhất quán cả chiều request lẫn response
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

// ── HTTP Request Logging ──────────────────────────────────────────────────────
builder.Services.AddHttpLogging(logging =>
{
    logging.LoggingFields = HttpLoggingFields.RequestMethod
                          | HttpLoggingFields.RequestPath
                          | HttpLoggingFields.RequestQuery
                          | HttpLoggingFields.ResponseStatusCode
                          | HttpLoggingFields.Duration;
    // Không log headers/body để tránh lộ thông tin nhạy cảm (password, token)
});


// ── Swagger / OpenAPI ─────────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "EduBoost API",
        Version = "v1",
        Description = "WebAPI cho ứng dụng học tập thông minh EduBoost.",
    });

    // JWT Bearer auth trong Swagger
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Nhập JWT token. Ví dụ: Bearer {your_token}"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            []
        }
    });

    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath)) c.IncludeXmlComments(xmlPath);
});

// ── Database — EF Core + PostgreSQL ──────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// ── JWT Authentication ────────────────────────────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? Environment.GetEnvironmentVariable("JWT_SECRET");
if (string.IsNullOrWhiteSpace(jwtSecret))
{
    if (builder.Environment.IsDevelopment())
        jwtSecret = "dev-only-secret-must-be-at-least-32-characters-long!";
    else
        throw new InvalidOperationException("Jwt:Secret or JWT_SECRET environment variable must be configured.");
}
if (jwtSecret.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase) && !builder.Environment.IsDevelopment())
    throw new InvalidOperationException("Jwt:Secret placeholder detected — set a strong secret via JWT_SECRET or appsettings.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "EduBoost";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "EduBoost";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.Zero // no grace period
        };
    });

builder.Services.AddAuthorization();

// ── MinIO Storage ─────────────────────────────────────────────────────────────
builder.Services.AddSingleton<IStorageService, MinioStorageService>();

// ── CORS ──────────────────────────────────────────────────────────────────────
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? (builder.Environment.IsDevelopment()
        ? ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
        : Array.Empty<string>());

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (corsOrigins.Length > 0)
            policy.WithOrigins(corsOrigins).AllowAnyMethod().AllowAnyHeader().AllowCredentials();
        else if (builder.Environment.IsDevelopment())
            policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
        else
            throw new InvalidOperationException("Cors:AllowedOrigins must be configured in production.");
    });
});

// ── DI — Infrastructure Services ────────────────────────────────────────────────
builder.Services.AddEduBoostFeatures();
builder.Services.AddAgentIntegration();

// ─────────────────────────────────────────────────────────────────────────────
var app = builder.Build();

// ── Auto-migrate + Seed on startup ───────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        logger.LogInformation("Applying EF Core migrations...");
        await db.Database.MigrateAsync();
        logger.LogInformation("Migrations applied successfully.");

        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        await AdminBootstrap.EnsureAsync(db, config, logger);

        var storage = scope.ServiceProvider.GetRequiredService<IStorageService>();
        // if (app.Environment.IsDevelopment())
        //     await DatabaseSeeder.SeedAsync(db, storage, logger);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred during startup (migrate/seed).");
        throw;
    }
}

// ── Swagger UI ────────────────────────────────────────────────────────────────
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "EduBoost API v1");
    c.RoutePrefix = "swagger";
    c.DocumentTitle = "EduBoost API";
});

// Redirect root → swagger
app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();

app.UseCors();
// app.UseHttpsRedirection(); // Đã bỏ — server chạy HTTP trong Docker, không có HTTPS cert
app.UseAuthentication();
app.UseAuthorization();

// HTTP logging — bỏ qua /health và /swagger để tránh noise
app.UseWhen(
    ctx => !ctx.Request.Path.StartsWithSegments("/health")
        && !ctx.Request.Path.StartsWithSegments("/swagger"),
    branch => branch.UseHttpLogging()
);

// Health check endpoint (used by Docker healthcheck)
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
   .ExcludeFromDescription();

app.MapControllers();

app.Run();
