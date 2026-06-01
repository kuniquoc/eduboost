import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { studentsService } from '@/services/students.service';
import { learningStateService } from '@/services/learningState.service';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Flame, Target, BookOpen, TrendingUp, CalendarClock } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="border-border">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function StudentDashboardPage() {
  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['student-progress'],
    queryFn: studentsService.getMyProgress,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['student-stats'],
    queryFn: studentsService.getMyStats,
  });

  const { data: reviewSchedule } = useQuery({
    queryKey: ['review-schedule'],
    queryFn: learningStateService.getReviewSchedule,
  });

  const isLoading = loadingProgress || loadingStats;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-20 animate-pulse border-border bg-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tổng quan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tiến độ học tập của bạn</p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Flame} label="Chuỗi ngày" value={`${stats.dayStreak} ngày`} />
          <StatCard icon={Target} label="Điểm TB" value={`${Math.round(stats.avgQuizScore)}%`} />
          <StatCard icon={BookOpen} label="Bài quiz" value={stats.totalQuizzesTaken} />
          <StatCard icon={TrendingUp} label="Tuần này" value={`${Math.round(stats.weeklyProgress)}%`} />
        </div>
      )}

      {/* Overall progress */}
      {progress && (
        <Card className="border-border">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Tiến độ tổng thể</h2>
              <span className="text-sm font-medium text-primary">{Math.round(progress.overallProgress)}%</span>
            </div>
            <Progress value={progress.overallProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Review reminder */}
      {reviewSchedule && reviewSchedule.totalDueToday > 0 && (
        <Link to="/student/review">
          <Card className="border-primary/20 bg-primary/5 transition-colors hover:border-primary/40">
            <CardContent className="flex items-center gap-4 p-4">
              <CalendarClock className="h-8 w-8 text-primary" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {reviewSchedule.totalDueToday} câu hỏi cần ôn tập hôm nay
                </p>
                <p className="text-sm text-muted-foreground">Ôn tập đúng lúc để ghi nhớ lâu hơn</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Enrolled classes */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Lớp học đang tham gia</h2>
        {!progress?.enrolledClasses?.length ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium text-foreground">Chưa tham gia lớp nào</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vào mục <Link to="/student/classes" className="text-primary hover:underline">Lớp học</Link> để tham gia
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {progress.enrolledClasses.map((c) => (
              <Link key={c.classId} to={c.entryTestCompleted ? `/student/roadmap/${c.classId}` : `/student/entry-test/${c.classId}`}>
                <Card className="group overflow-hidden border-border transition-colors hover:border-primary/40">
                  <div className="h-2" style={{ backgroundColor: c.coverColor }} />
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{c.className}</h3>
                    <div className="mt-3 flex items-center gap-2">
                      <Progress value={c.progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground">{Math.round(c.progress)}%</span>
                    </div>
                    <div className="mt-2">
                      {c.entryTestCompleted ? (
                        <Badge variant="secondary">Đã test đầu vào</Badge>
                      ) : (
                        <Badge variant="outline">Cần làm test đầu vào</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
