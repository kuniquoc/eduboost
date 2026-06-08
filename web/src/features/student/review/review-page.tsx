import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { learningStateService } from '@/services/learningState.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Brain, BookOpen } from 'lucide-react';

export function ReviewPage() {
  const navigate = useNavigate();

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['review-schedule'],
    queryFn: learningStateService.getReviewSchedule,
  });

  const { data: states } = useQuery({
    queryKey: ['learning-states'],
    queryFn: learningStateService.getStates,
  });

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
      <div>
        <h1 className="text-2xl font-bold">Ôn tập</h1>
        <p className="text-muted-foreground">Spaced Repetition — ôn tập đúng thời điểm để ghi nhớ lâu hơn</p>
      </div>

      {/* Summary card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-4 p-6">
          <Calendar className="h-10 w-10 text-primary" />
          <div>
            <p className="text-3xl font-bold text-primary">{schedule?.totalDueToday ?? 0}</p>
            <p className="text-sm text-muted-foreground">câu hỏi cần ôn tập hôm nay</p>
          </div>
        </CardContent>
      </Card>

      {/* Mastery overview */}
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

      {/* Due items */}
      {schedule && schedule.items.length > 0 ? (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Cần ôn tập</h2>
          <div className="space-y-3">
            {schedule.items.map((item) => (
              <Card key={item.questionId}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Brain className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{item.topicName}</p>
                      <p className="text-xs text-muted-foreground">
                        Lần ôn: {item.repetitionCount} • Retention: {Math.round(item.retentionScore * 100)}%
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(`/student/practice-session?topicId=${item.topicId}&topicName=${encodeURIComponent(item.topicName)}`)
                    }
                  >
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
