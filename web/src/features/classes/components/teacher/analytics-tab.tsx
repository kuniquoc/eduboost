import { useState } from 'react';
import { useClassAnalytics } from '@/features/classes/hooks/use-class-analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Progress } from '@/shared/ui/progress';
import { BarChart3, Users, AlertTriangle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/shared/ui/button';

function StudentAnalyticsCard({
  student,
}: {
  student: import('@/features/students/types').StudentAnalyticsDto;
}) {
  const [expanded, setExpanded] = useState(false);
  const correctPct = Math.round((student.correctRatio ?? 0) * 100);

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{student.studentName}</p>
          <p className="text-xs text-muted-foreground">{student.email}</p>
        </div>
        <div className="flex gap-2">
          {!student.entryTestCompleted && (
            <Badge variant="destructive">Chưa làm placement test</Badge>
          )}
          <Badge variant="outline">Hoạt động: {student.lastActive}</Badge>
        </div>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span>Lần làm quiz: {student.quizzesTaken}</span>
        <span>Tỉ lệ đúng: {correctPct}%</span>
        <span>Điểm TB: {student.averageScore}%</span>
      </div>
      <Progress value={student.completionPercent} className="h-1.5" />

      {student.weakSkills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {student.weakSkills.map((w) => (
            <Badge key={w.topicId} variant="secondary" className="text-xs">
              Yếu: {w.topicName} ({w.score}%)
            </Badge>
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="mt-3 w-full"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
        {expanded ? 'Thu gọn' : 'Xem thành thạo theo chủ đề'}
      </Button>

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {student.topicMasteries?.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Thành thạo theo chủ đề</p>
              <div className="space-y-2">
                {student.topicMasteries.map((t) => (
                  <div key={t.topicId}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{t.topicName}</span>
                      <span>{Math.round(t.masteryProbability * 100)}%</span>
                    </div>
                    <Progress value={t.masteryProbability * 100} className="h-1.5" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {student.quizAttemptStats?.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Chi tiết theo quiz</p>
              <div className="space-y-2">
                {student.quizAttemptStats.map((q) => (
                  <div key={q.quizId} className="flex flex-wrap justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                    <span className="font-medium">{q.quizTitle}</span>
                    <span>
                      {q.attemptCount} lần · {Math.round(q.correctRatio * 100)}% đúng
                      ({q.correctCount}/{q.totalQuestions} câu)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
              <p className="text-2xl font-bold">{analytics.needAttentionCount ?? analytics.studentsCompleted}</p>
              <p className="text-xs text-muted-foreground">Cần chú ý / Hoàn thành ≥80%</p>
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
            <StudentAnalyticsCard key={s.studentId} student={s} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
