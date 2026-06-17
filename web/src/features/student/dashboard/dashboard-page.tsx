import { Link } from 'react-router-dom';
import { placementTestPath } from '@/lib/constants';
import { useStudentProgress } from '@/hooks/use-student-progress';
import { useStudentStats } from '@/hooks/use-student-stats';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Flame, BookOpen, TrendingUp } from 'lucide-react';

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
  const { data: progress, isLoading: loadingProgress } = useStudentProgress();
  const { data: stats, isLoading: loadingStats } = useStudentStats();

  const isLoading = loadingProgress || loadingStats;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={Flame} label="Chuỗi ngày" value={`${stats.dayStreak} ngày`} />
          <StatCard icon={BookOpen} label="Bài đã làm" value={stats.totalQuizzesTaken} />
          <StatCard
            icon={TrendingUp}
            label="Tỉ lệ đúng tuần này"
            value={`${Math.round(stats.weeklyProgress)}%`}
          />
        </div>
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
              <Link key={c.classId} to={c.entryTestCompleted ? `/student/roadmap/${c.classId}` : placementTestPath(c.classId)}>
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
