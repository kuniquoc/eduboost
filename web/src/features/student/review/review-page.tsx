import { useNavigate } from 'react-router-dom';
import { useLearningStates } from '@/hooks/use-learning-states';
import { useReviewSchedule } from '@/hooks/use-review-schedule';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Brain, BookOpen, Clock } from 'lucide-react';

function milestoneLabel(repetitionCount: number, reviewInterval: number): string {
  if (repetitionCount === 0) return 'Chưa ôn';
  if (repetitionCount === 1) return 'Mốc 1 • 1 ngày';
  if (repetitionCount === 2) return 'Mốc 2 • 6 ngày';
  return `Mốc ${repetitionCount} • ${Math.round(reviewInterval)} ngày`;
}

export function ReviewPage() {
  const navigate = useNavigate();

  const { data: schedule, isLoading } = useReviewSchedule();
  const { data: states } = useLearningStates();

  const handleReviewAll = () => {
    navigate('/student/practice-session?mode=review');
  };

  const handleReviewOne = (item: { questionId: string; topicId: string; topicName: string }) => {
    navigate(
      `/student/practice-session?mode=review&questionIds=${item.questionId}&topicId=${item.topicId}&topicName=${encodeURIComponent(item.topicName)}`,
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-32 animate-pulse bg-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ôn tập</h1>
          <p className="text-muted-foreground">Spaced Repetition — ôn tập đúng thời điểm để ghi nhớ lâu hơn</p>
        </div>
        {schedule && schedule.totalDueToday > 0 && (
          <Button onClick={handleReviewAll}>
            <BookOpen className="mr-2 h-4 w-4" />
            Ôn tất cả hôm nay ({schedule.totalDueToday})
          </Button>
        )}
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-4 p-6">
          <Calendar className="h-10 w-10 text-primary" />
          <div>
            <p className="text-3xl font-bold text-primary">{schedule?.totalDueToday ?? 0}</p>
            <p className="text-sm text-muted-foreground">câu hỏi cần ôn tập hôm nay</p>
          </div>
        </CardContent>
      </Card>

      {states && states.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Mức độ thành thạo</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {states.map((s) => (
              <Card key={s.topicId}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{s.topicName}</p>
                    <Badge variant={s.masteryProbability >= 0.8 ? 'default' : 'secondary'}>
                      {Math.round(s.masteryProbability * 100)}%
                    </Badge>
                  </div>
                  <Progress value={s.masteryProbability * 100} className="mt-2 h-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {schedule && schedule.items.length > 0 ? (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Cần ôn tập</h2>
          <div className="space-y-3">
            {schedule.items.map((item) => (
              <Card key={item.questionId}>
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Brain className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.topicName}</p>
                      {item.questionText && (
                        <p className="mt-1 truncate text-sm text-muted-foreground">{item.questionText}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{milestoneLabel(item.repetitionCount, item.reviewInterval)}</Badge>
                        <Badge variant="secondary">
                          Retention {Math.round(item.retentionScore * 100)}%
                        </Badge>
                        {item.overdueHours != null && item.overdueHours > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Quá hạn {Math.round(item.overdueHours)}h
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button size="sm" className="shrink-0" onClick={() => handleReviewOne(item)}>
                    <BookOpen className="mr-1 h-4 w-4" /> Ôn tập
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-10 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-3 font-medium">Không có bài ôn tập nào hôm nay</p>
            <p className="text-sm text-muted-foreground">Hãy tiếp tục luyện tập để có bài ôn định kỳ</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
