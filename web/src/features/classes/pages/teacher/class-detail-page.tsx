import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { classesService } from '@/features/classes/api/classes.service';
import { quizzesService } from '@/features/quizzes/api/quizzes.service';
import { useClassDetail } from '@/features/classes/hooks/use-class-detail';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/shared/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { ArrowLeft, Settings, Copy, Check, Trash2, PenLine, FileQuestion } from 'lucide-react';
import { toast } from 'sonner';
import { EntryTestPoolPickerDialog } from '@/features/quiz-pool/components/entry-test-pool-picker-dialog';
import { TopicsTab } from '@/features/classes/components/teacher/topics-tab';
import { DocumentsTab } from '@/features/classes/components/teacher/documents-tab';
import { StudentsTab } from '@/features/classes/components/teacher/students-tab';
import { AnalyticsTab } from '@/features/classes/components/teacher/analytics-tab';
import { QuizzesTab } from '@/features/classes/components/teacher/quizzes-tab';
import { QuizBuilderDialog } from '@/features/quizzes/components/quiz-builder-dialog';
import type { CreateQuestionPayload } from '@/features/quizzes/types';

export function TeacherClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [quizBuilderOpen, setQuizBuilderOpen] = useState(false);
  const [entryTestPickerOpen, setEntryTestPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: cls, isLoading } = useClassDetail(id);

  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const updateMutation = useMutation({
    mutationFn: () => classesService.updateClass(id!, { name: editName, description: editDesc }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['teacher-classes'] });
      toast.success('Cập nhật thành công');
      setEditOpen(false);
    },
    onError: () => toast.error('Cập nhật thất bại'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => classesService.deleteClass(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-classes'] });
      toast.success('Đã xóa lớp học');
      navigate('/teacher/classes');
    },
    onError: () => toast.error('Xóa thất bại'),
  });

  const createQuizMutation = useMutation({
    mutationFn: (data: { title: string; questions: CreateQuestionPayload[]; type?: 'practice' | 'entry_test' }) =>
      quizzesService.createQuiz({ title: data.title, classId: id, type: data.type, questions: data.questions }),
    onSuccess: (quiz) => {
      queryClient.invalidateQueries({ queryKey: ['class-quizzes', id] });
      toast.success('Tạo quiz thành công');
      setQuizBuilderOpen(false);
      navigate(`/teacher/ai-studio/${quiz.id}`);
    },
    onError: () => toast.error('Tạo quiz thất bại'),
  });

  const openEdit = () => {
    if (cls) {
      setEditName(cls.name);
      setEditDesc(cls.description);
    }
    setEditOpen(true);
  };

  const copyCode = () => {
    if (cls) {
      navigator.clipboard.writeText(cls.classCode);
      setCopied(true);
      toast.success('Đã sao chép mã lớp');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!cls) {
    return <p className="text-muted-foreground">Không tìm thấy lớp học</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/teacher/classes')}
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{cls.name}</h1>
            {cls.description && (
              <p className="mt-1 text-sm text-muted-foreground">{cls.description}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
              <span>{cls.studentCount} học sinh</span>
              <span>·</span>
              <span>{cls.topicCount} chủ đề</span>
              <span>·</span>
              <button
                onClick={copyCode}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                Mã: {cls.classCode}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEntryTestPickerOpen(true)}
            >
              <FileQuestion className="h-4 w-4" /> Tạo test đầu vào từ Pool
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQuizBuilderOpen(true)}>
              <PenLine className="h-4 w-4" /> Tạo quiz
            </Button>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Settings className="h-4 w-4" /> Sửa
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="topics">
        <TabsList>
          <TabsTrigger value="topics">Chủ đề ({cls.topics?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="quizzes">Quiz</TabsTrigger>
          <TabsTrigger value="documents">Tài liệu</TabsTrigger>
          <TabsTrigger value="students">Học sinh ({cls.studentCount})</TabsTrigger>
          <TabsTrigger value="analytics">Phân tích</TabsTrigger>
        </TabsList>
        <TabsContent value="topics" className="mt-4">
          <TopicsTab classId={id!} topics={cls.topics ?? []} />
        </TabsContent>
        <TabsContent value="quizzes" className="mt-4">
          <QuizzesTab classId={id!} activeEntryTestId={cls.activeEntryTestId} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <DocumentsTab classId={id!} />
        </TabsContent>
        <TabsContent value="students" className="mt-4">
          <StudentsTab classId={id!} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab classId={id!} />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa lớp học</DialogTitle>
            <DialogDescription>Cập nhật thông tin lớp</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Tên lớp</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa lớp học</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa lớp <strong>{cls.name}</strong>? Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz Builder Dialog */}
      <QuizBuilderDialog
        open={quizBuilderOpen}
        onOpenChange={setQuizBuilderOpen}
        onSubmit={(title, questions) => createQuizMutation.mutate({ title, questions })}
        isPending={createQuizMutation.isPending}
        dialogTitle="Tạo quiz cho lớp"
        dialogDescription="Tạo quiz luyện tập để giao cho học sinh"
      />

      <EntryTestPoolPickerDialog
        open={entryTestPickerOpen}
        onOpenChange={setEntryTestPickerOpen}
        classId={id!}
        className={cls.name}
        onSuccess={(quiz) => {
          queryClient.invalidateQueries({ queryKey: ['class-quizzes', id] });
          navigate(`/teacher/ai-studio/${quiz.id}`);
        }}
      />
    </div>
  );
}
