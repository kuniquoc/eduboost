import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';
import type { TopicSummary } from '@/types';

const diffLabel: Record<string, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
};

export function StudentTopicsTab({ topics }: { topics: TopicSummary[] }) {
  if (topics.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
          <BookOpen className="mb-3 h-10 w-10 opacity-50" />
          <p>Chưa có chủ đề nào trong lớp.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {topics.map((t) => (
        <Card key={t.id}>
          <CardContent className="p-4">
            <p className="font-medium">{t.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{diffLabel[t.difficulty] ?? t.difficulty}</Badge>
              <Badge variant="outline">{t.questionCount} câu hỏi</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
