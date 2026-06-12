import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { quizzesService } from '@/services/quizzes.service';
import { useClassDetail } from '@/hooks/use-class-detail';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, BookOpen, ClipboardCheck, Loader2, FileQuestion } from 'lucide-react';

export function ClassQuizzesPage() {
  const { classId = '' } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { data: classDetail } = useClassDetail(classId);

  const { data: quizzes = [], isLoading } = useQuery({
    queryKey: ['class-quizzes', classId],
    queryFn: () => quizzesService.getClassQuizzes(classId),
    enabled: !!classId,
  });

  // Include both "practice" and "pool" types — pool quizzes assigned to a class
  // and published by the teacher should also be visible to enrolled students.
  const practiceQuizzes = quizzes.filter(
    (q) => (q.type === 'practice' || q.type === 'pool') && q.isPublished,
  );

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

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/student/roadmap/${classId}`)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại lộ trình
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Quiz lớp học</h1>
        <p className="mt-1 text-muted-foreground">
          {classDetail?.name ?? 'Lớp học'} — Luyện tập có phản hồi ngay; bài kiểm tra chỉ xem kết quả sau khi nộp.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : practiceQuizzes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <FileQuestion className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="font-medium">Chưa có quiz luyện tập nào được publish</p>
            <p className="mt-1 text-sm text-muted-foreground">Giáo viên cần publish quiz trước khi bạn có thể làm bài.</p>
          </CardContent>
        </Card>
      ) : (
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
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => startPractice(quiz.id, quiz.title)}>
                    <BookOpen className="mr-2 h-4 w-4" /> Luyện tập
                  </Button>
                  <Button size="sm" onClick={() => startTest(quiz.id, quiz.title)}>
                    <ClipboardCheck className="mr-2 h-4 w-4" /> Làm bài kiểm tra
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
