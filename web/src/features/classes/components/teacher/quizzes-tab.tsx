import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClassQuizzes } from '@/features/quizzes/hooks/use-class-quizzes';
import { classesService } from '@/features/classes/api/classes.service';
import { quizzesService } from '@/features/quizzes/api/quizzes.service';
import { Card, CardContent } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/shared/ui/dialog';
import { FileQuestion, PenLine, Eye, Trash2, Star, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

const typeLabels: Record<string, { label: string; icon: LucideIcon }> = {
  entry_test: { label: 'Test đầu vào', icon: FileQuestion },
  practice:   { label: 'Luyện tập', icon: PenLine },
};

interface QuizzesTabProps {
  classId: string;
  activeEntryTestId?: string;
}

export function QuizzesTab({ classId, activeEntryTestId }: QuizzesTabProps) {
  const queryClient = useQueryClient();
  const { data: quizzes, isLoading } = useClassQuizzes(classId);

  const [deleteQuizId, setDeleteQuizId] = useState<string | null>(null);

  const setActiveMutation = useMutation({
    mutationFn: (quizId: string) => classesService.setActiveEntryTest(classId, quizId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-detail', classId] });
      toast.success('Đã đặt bài test đầu vào active');
    },
    onError: () => toast.error('Đặt active thất bại'),
  });

  const deleteQuizMutation = useMutation({
    mutationFn: (quizId: string) => quizzesService.deleteQuiz(quizId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-quizzes', classId] });
      queryClient.invalidateQueries({ queryKey: ['class-detail', classId] });
      toast.success('Đã xoá bài test');
      setDeleteQuizId(null);
    },
    onError: () => toast.error('Xoá thất bại'),
  });

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
          Tạo chủ đề + AI sinh câu hỏi, upload tài liệu, hoặc tạo quiz thủ công
        </p>
      </div>
    );
  }

  const entryTests = quizzes.filter((q) => q.type === 'entry_test');
  const practiceQuizzes = quizzes.filter((q) => q.type !== 'entry_test');
  const quizToDelete = quizzes.find((q) => q.id === deleteQuizId);

  return (
    <div className="space-y-6">
      {/* Entry tests section */}
      {entryTests.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Bài test đầu vào ({entryTests.length})
          </h3>
          <div className="space-y-2">
            {entryTests.map((quiz) => {
              const isActive = quiz.id === activeEntryTestId;
              return (
                <Card
                  key={quiz.id}
                  className={isActive ? 'border-primary/40 bg-primary/5' : 'border-border'}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileQuestion className={`h-5 w-5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{quiz.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {quiz.questionCount} câu hỏi · {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive && (
                        <Badge className="bg-primary/20 text-primary border-primary/30 gap-1">
                          <Star className="h-3 w-3 fill-current" /> Active
                        </Badge>
                      )}
                      <Badge variant={quiz.isPublished ? 'default' : 'outline'}>
                        {quiz.isPublished ? 'Đã publish' : 'Nháp'}
                      </Badge>
                      {!isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveMutation.mutate(quiz.id)}
                          disabled={setActiveMutation.isPending}
                        >
                          <Star className="h-3.5 w-3.5" /> Đặt active
                        </Button>
                      )}
                      <Link to={`/teacher/ai-studio/${quiz.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-3.5 w-3.5" /> Xem & Sửa
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                        onClick={() => setDeleteQuizId(quiz.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Practice quizzes */}
      {practiceQuizzes.length > 0 && (
        <div>
          {entryTests.length > 0 && (
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Quiz luyện tập</h3>
          )}
          <div className="space-y-2">
            {practiceQuizzes.map((quiz) => {
              const typeInfo = typeLabels[quiz.type ?? 'practice'] ?? typeLabels.practice;
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteQuizId} onOpenChange={(open) => { if (!open) setDeleteQuizId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá bài test đầu vào?</DialogTitle>
            <DialogDescription>
              Bài test <span className="font-medium">"{quizToDelete?.title}"</span> sẽ bị xoá vĩnh viễn cùng tất cả câu hỏi.
              {quizToDelete?.id === activeEntryTestId && (
                <span className="block mt-1 text-amber-500 font-medium">
                  Đây là bài test đang active. Sau khi xoá, lớp học sẽ không có bài test active.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteQuizId(null)}>Huỷ</Button>
            <Button
              variant="destructive"
              onClick={() => deleteQuizId && deleteQuizMutation.mutate(deleteQuizId)}
              disabled={deleteQuizMutation.isPending}
            >
              {deleteQuizMutation.isPending ? 'Đang xoá...' : 'Xoá'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
