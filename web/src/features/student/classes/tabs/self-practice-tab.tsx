import { useRoadmap } from '@/hooks/use-roadmap';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PlayCircle, Star, CheckCircle } from 'lucide-react';
import type { RoadmapStepStatus, TopicSummary } from '@/types';

const roadmapStatusLabel: Record<RoadmapStepStatus, string> = {
  completed: 'Hoàn thành',
  in_progress: 'Có thể học',
  recommended: 'Đề xuất',
  locked: 'Có thể học',
};

export function StudentSelfPracticeTab({
  classId,
  topics,
}: {
  classId: string;
  topics: TopicSummary[];
}) {
  const navigate = useNavigate();
  const [selectedTopicId, setSelectedTopicId] = useState(topics[0]?.id ?? '');
  const { data: roadmap } = useRoadmap(classId);
  const selectedTopic = topics.find((t) => t.id === selectedTopicId);

  const startPractice = (topicId = selectedTopicId) => {
    if (!topicId) return;
    navigate(`/student/practice/${topicId}`);
  };

  const steps = roadmap?.steps ? [...roadmap.steps].sort((a, b) => a.orderIndex - b.orderIndex) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="font-semibold">Bắt đầu tự luyện tập</h3>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-sm text-muted-foreground">Chủ đề</label>
              <Select value={selectedTopicId} onValueChange={(v) => v && setSelectedTopicId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn chủ đề">
                    {selectedTopic?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {topics.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => startPractice()} disabled={!selectedTopicId}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Bắt đầu luyện tập
            </Button>
          </div>
        </CardContent>
      </Card>

      {steps.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold">Lộ trình học tập</h3>
          <div className="space-y-2">
            {steps.map((step) => (
              <Card key={step.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    {step.status === 'completed' ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : step.status === 'recommended' ? (
                      <Star className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <PlayCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{step.topicName}</p>
                      {typeof step.progress === 'number' && (
                        <div className="mt-1 flex items-center gap-2">
                          <Progress value={step.progress} className="h-1.5 w-24" />
                          <span className="text-xs text-muted-foreground">
                            {Math.round(step.progress)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={step.status === 'recommended' ? 'default' : 'outline'}>
                      {roadmapStatusLabel[step.status]}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startPractice(step.topicId)}
                    >
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Luyện tập
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
