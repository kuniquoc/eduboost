import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { roadmapService } from '@/services/roadmap.service';
import { useClassDetail } from '@/hooks/use-class-detail';
import { useRoadmap } from '@/hooks/use-roadmap';
import { placementTestService } from '@/services/placementTest.service';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, CheckCircle, PlayCircle, Star, BookOpen, ClipboardList, Users, RefreshCw } from 'lucide-react';
import { placementTestPath } from '@/lib/constants';
import { toast } from 'sonner';
import type { RoadmapStepStatus } from '@/types';

const statusConfig: Record<RoadmapStepStatus, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  badge: 'default' | 'secondary' | 'outline' | 'destructive';
}> = {
  completed: { icon: CheckCircle, label: 'Hoàn thành', color: 'text-green-400', badge: 'secondary' },
  in_progress: { icon: PlayCircle, label: 'Có thể học', color: 'text-primary', badge: 'default' },
  recommended: { icon: Star, label: 'Đề xuất', color: 'text-yellow-400', badge: 'outline' },
  locked: { icon: PlayCircle, label: 'Có thể học', color: 'text-primary', badge: 'outline' },
};

export function RoadmapPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: classDetail } = useClassDetail(classId);
  const { data: roadmap, isLoading } = useRoadmap(classId);

  const refreshMutation = useMutation({
    mutationFn: async () => {
      try {
        const result = await placementTestService.getResult(classId!);
        return roadmapService.generateRoadmap(classId!, result.id);
      } catch {
        return roadmapService.generateRoadmap(classId!, '');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmap', classId] });
      toast.success('Đã cập nhật lộ trình học tập');
    },
    onError: () => toast.error('Không thể làm mới lộ trình'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-20 animate-pulse border-border bg-card" />
        ))}
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div>
        <button
          onClick={() => navigate('/student/classes')}
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </button>

        {classDetail && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">{classDetail.name}</h1>
            {classDetail.description && (
              <p className="mt-1 text-sm text-muted-foreground">{classDetail.description}</p>
            )}
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> {classDetail.studentCount} bạn học</span>
              <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> {classDetail.topicCount} chủ đề</span>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium text-foreground">Chưa có lộ trình học tập</p>
          <p className="mt-1 text-sm text-muted-foreground">Hãy làm bài test đầu vào để AI tạo lộ trình phù hợp</p>
          <Button onClick={() => navigate(placementTestPath(classId!))} className="mt-4">
            Làm bài test đầu vào
          </Button>
        </div>
      </div>
    );
  }

  const steps = [...roadmap.steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const completedCount = steps.filter((s) => s.status === 'completed').length;

  return (
    <div>
      <button
        onClick={() => navigate('/student/classes')}
        className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lộ trình học tập</h1>
          <div className="mt-2 flex items-center gap-3">
            <Progress value={(completedCount / steps.length) * 100} className="h-2 flex-1 max-w-xs" />
            <span className="text-sm text-muted-foreground">{completedCount}/{steps.length} hoàn thành</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/student/classes/${classId}/quizzes`}
            className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            Quiz lớp
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            Làm mới lộ trình
          </Button>
        </div>
      </div>

      {/* Steps timeline */}
      <div className="relative space-y-0">
        {steps.map((step, i) => {
          const config = statusConfig[step.status];
          const Icon = config.icon;
          const isLast = i === steps.length - 1;
          return (
            <div key={step.id} className="relative flex gap-4">
              {/* Timeline line + icon */}
              <div className="flex flex-col items-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  step.status === 'completed' ? 'border-green-400 bg-green-400/10' :
                  step.status === 'in_progress' ? 'border-primary bg-primary/10' :
                  step.status === 'recommended' ? 'border-yellow-400 bg-yellow-400/10' :
                  'border-primary/40 bg-primary/5'
                }`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                {!isLast && (
                  <div className={`w-0.5 flex-1 min-h-4 ${
                    step.status === 'completed' ? 'bg-green-400/30' : 'bg-border'
                  }`} />
                )}
              </div>

              {/* Content card */}
              <div className="flex-1 pb-6">
                <Link to={`/student/practice/${step.topicId}`}>
                  <Card className="border-border transition-colors hover:border-primary/40">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{step.topicName}</h3>
                          {step.reason && (
                            <p className="mt-1 text-xs text-muted-foreground">{step.reason}</p>
                          )}
                          {(typeof step.mastery === 'number' || typeof step.theta === 'number' || typeof step.topicBeta === 'number') && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {typeof step.mastery === 'number' ? `Mastery ${step.mastery.toFixed(2)} · ` : ''}
                              {typeof step.theta === 'number' ? `Theta ${step.theta.toFixed(2)} · ` : ''}
                              {typeof step.topicBeta === 'number' ? `Beta ${step.topicBeta.toFixed(2)}` : ''}
                              {typeof step.dueCount === 'number' ? ` · Due ${step.dueCount}` : ''}
                            </p>
                          )}
                        </div>
                        <Badge variant={config.badge}>{config.label}</Badge>
                      </div>
                      {step.progress > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                          <Progress value={step.progress} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground">{Math.round(step.progress)}%</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
