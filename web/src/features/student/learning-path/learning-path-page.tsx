import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { learningPathService } from '@/services/learningPath.service';
import { ROUTES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, RefreshCw, Map, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export function LearningPathPage() {
  const queryClient = useQueryClient();

  const { data: path, isLoading } = useQuery({
    queryKey: ['learning-path'],
    queryFn: learningPathService.getPath,
  });

  const regenerateMutation = useMutation({
    mutationFn: learningPathService.regenerate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-path'] });
      toast.success('Đã cập nhật lộ trình học tập');
    },
    onError: () => toast.error('Không thể tái sinh lộ trình'),
  });

  const completeMutation = useMutation({
    mutationFn: learningPathService.markItemComplete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning-path'] });
      toast.success('Đã đánh dấu hoàn thành');
    },
    onError: () => toast.error('Cập nhật thất bại'),
  });

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-card" />;
  }

  const progress = path?.overallProgress ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Map className="h-7 w-7 text-primary" />
            Lộ trình học tập
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gợi ý chủ đề ôn luyện dựa trên mức độ thành thạo (BKT) của bạn
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
          Tái sinh lộ trình
        </Button>
      </div>

      <Card className="border-border">
        <CardContent className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tiến độ tổng thể</span>
            <span className="font-semibold text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {path?.completedItems ?? 0}/{path?.totalItems ?? 0} chủ đề hoàn thành
          </p>
        </CardContent>
      </Card>

      {!path?.items.length ? (
        <Card className="border-dashed border-border">
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">Chưa có lộ trình</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Hoàn thành bài kiểm tra đầu vào hoặc nhấn &quot;Tái sinh lộ trình&quot;
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {path.items.map((item) => (
            <Card key={item.id} className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">{item.topicName}</CardTitle>
                <Badge variant={item.isCompleted ? 'default' : 'secondary'}>
                  {item.recommendedDifficulty}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Ưu tiên: {Math.round(item.priorityScore * 100)}%
                  {item.nextReviewDate && ` · Ôn lại: ${item.nextReviewDate}`}
                </div>
                <div className="flex gap-2">
                  {!item.isCompleted && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => completeMutation.mutate(item.id)}
                      disabled={completeMutation.isPending}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Hoàn thành
                    </Button>
                  )}
                  <Button size="sm" render={<Link to={ROUTES.STUDENT_PRACTICE.replace(':topicId', item.topicId)} />}>
                    Luyện tập
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
