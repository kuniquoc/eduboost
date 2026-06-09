import { Link } from 'react-router-dom';
import { useClassQuizzes } from '@/hooks/use-class-quizzes';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileQuestion, PenLine, Eye, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const typeLabels: Record<string, { label: string; icon: LucideIcon }> = {
  entry_test: { label: 'Test đầu vào', icon: FileQuestion },
  practice:   { label: 'Luyện tập', icon: PenLine },
};

export function QuizzesTab({ classId }: { classId: string }) {
  const { data: quizzes, isLoading } = useClassQuizzes(classId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="h-16 animate-pulse border-border bg-card" />
        ))}
      </div>
    );
  }

  if (!quizzes?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <FileQuestion className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="text-lg font-medium text-foreground">Chưa có quiz</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tạo quiz thủ công hoặc upload tài liệu để AI tạo quiz
        </p>
      </div>
    );
  }

  // Separate entry test from practice quizzes
  const entryTest = quizzes.find((q) => q.type === 'entry_test');
  const practiceQuizzes = quizzes.filter((q) => q.type !== 'entry_test');

  return (
    <div className="space-y-4">
      {/* Entry test section */}
      {entryTest && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bài test đầu vào</h3>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 min-w-0">
                <FileQuestion className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{entryTest.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {entryTest.questionCount} câu hỏi · {new Date(entryTest.createdAt).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={entryTest.isPublished ? 'default' : 'outline'}>
                  {entryTest.isPublished ? 'Đã publish' : 'Nháp'}
                </Badge>
                <Link to={`/teacher/ai-studio/${entryTest.id}`}>
                  <Button variant="outline" size="sm">
                    <Eye className="h-3.5 w-3.5" /> Xem & Sửa
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Practice quizzes */}
      {practiceQuizzes.length > 0 && (
        <div>
          {entryTest && <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Quiz luyện tập</h3>}
          <div className="space-y-2">
            {practiceQuizzes.map((quiz) => {
              const typeInfo = typeLabels[quiz.type] ?? typeLabels.practice;
              const Icon = typeInfo.icon;
              return (
                <Card key={quiz.id} className="border-border">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{quiz.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {quiz.questionCount} câu hỏi · {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={quiz.isPublished ? 'default' : 'outline'}>
                        {quiz.isPublished ? 'Đã publish' : 'Nháp'}
                      </Badge>
                      <Link to={`/teacher/ai-studio/${quiz.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-3.5 w-3.5" /> Xem & Sửa
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
