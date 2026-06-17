import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { quizzesService } from '@/services/quizzes.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ClipboardCheck, Loader2, FileQuestion } from 'lucide-react';

export function StudentQuizzesTab({ classId }: { classId: string }) {
  const navigate = useNavigate();

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['class-quizzes', classId],
    queryFn: () => quizzesService.getClassQuizzes(classId),
    enabled: !!classId,
  });

  const practiceQuizzes = quizzes.filter(
    (q) => q.type === 'practice' || (q.type as string) === 'pool',
  ).filter((q) => q.isPublished);

  const startPractice = (quizId: string, title: string) => {
    const params = new URLSearchParams({
      mode: 'practice',
      quizId,
      topicName: title,
    });
    navigate(`/student/practice-session?${params.toString()}`);
  };

  const startTest = (quizId: string, title: string) => {
    const params = new URLSearchParams({
      mode: 'test',
      quizId,
      topicName: title,
    });
    navigate(`/student/practice-session?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (practiceQuizzes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <FileQuestion className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="font-medium">Chưa có quiz nào được publish</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Giáo viên cần publish quiz trước khi bạn có thể làm bài.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {practiceQuizzes.map((quiz) => (
        <Card key={quiz.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{quiz.title}</p>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{quiz.questionCount} câu</Badge>
                <span>Đã publish</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => startPractice(quiz.id, quiz.title)}>
                <BookOpen className="mr-2 h-4 w-4" /> Luyện tập
              </Button>
              <Button size="sm" onClick={() => startTest(quiz.id, quiz.title)}>
                <ClipboardCheck className="mr-2 h-4 w-4" /> Bài kiểm tra
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
