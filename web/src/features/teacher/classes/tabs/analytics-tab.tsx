import { useClassAnalytics } from '@/hooks/use-class-analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart3, Users, AlertTriangle, TrendingUp } from 'lucide-react';

export function AnalyticsTab({ classId }: { classId: string }) {
  const { data: analytics, isLoading } = useClassAnalytics(classId);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-card" />;
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{analytics.totalStudents}</p>
              <p className="text-xs text-muted-foreground">Học sinh</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{analytics.avgCompletion}%</p>
              <p className="text-xs text-muted-foreground">Tiến độ TB</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <BarChart3 className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{analytics.avgScore}%</p>
              <p className="text-xs text-muted-foreground">Điểm TB</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{analytics.studentsCompleted}</p>
              <p className="text-xs text-muted-foreground">Hoàn thành ≥80%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Chi tiết học sinh</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {analytics.students.map((s) => (
            <div key={s.studentId} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{s.studentName}</p>
                  <p className="text-xs text-muted-foreground">{s.email}</p>
                </div>
                <div className="flex gap-2">
                  {!s.entryTestCompleted && (
                    <Badge variant="destructive">Chưa làm placement test</Badge>
                  )}
                  <Badge variant="outline">Hoạt động: {s.lastActive}</Badge>
                </div>
              </div>
              <div className="mb-2 flex items-center gap-4 text-sm text-muted-foreground">
                <span>Quiz: {s.quizzesTaken}</span>
                <span>Điểm TB: {s.averageScore}%</span>
              </div>
              <Progress value={s.completionPercent} className="h-1.5" />
              {s.weakSkills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.weakSkills.map((w) => (
                    <Badge key={w.topicId} variant="secondary" className="text-xs">
                      {w.topicName} ({w.score}%)
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
