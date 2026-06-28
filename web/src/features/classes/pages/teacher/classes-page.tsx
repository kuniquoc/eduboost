import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeacherClasses } from '@/features/classes/hooks/use-teacher-classes';
import { classesService } from '@/features/classes/api/classes.service';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/shared/ui/dialog';
import { Plus, Users, BookOpen, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { ClassDto } from '@/features/classes/types';

const COVER_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

function CreateClassDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0]);

  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => classesService.createClass({ name, description, coverColor }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-classes'] });
      toast.success('Tạo lớp học thành công!');
      setOpen(false);
      setName('');
      setDescription('');
      setCoverColor(COVER_COLORS[0]);
      onCreated();
    },
    onError: () => toast.error('Tạo lớp thất bại'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" /> Tạo lớp mới
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo lớp học mới</DialogTitle>
          <DialogDescription>Nhập thông tin lớp học</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="class-name">Tên lớp</Label>
            <Input
              id="class-name"
              placeholder="VD: Toán 12A1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-desc">Mô tả</Label>
            <Textarea
              id="class-desc"
              placeholder="Mô tả ngắn về lớp..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Màu bìa</Label>
            <div className="flex gap-2">
              {COVER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-8 w-8 rounded-full ring-offset-2 ring-offset-background transition-all ${c === coverColor ? 'ring-2 ring-primary' : 'ring-1 ring-transparent hover:ring-muted-foreground'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setCoverColor(c)}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || !name.trim()}>
              {mutation.isPending ? 'Đang tạo...' : 'Tạo lớp'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClassCard({ cls }: { cls: ClassDto }) {
  const [copied, setCopied] = useState(false);

  const copyCode = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(cls.classCode);
    setCopied(true);
    toast.success('Đã sao chép mã lớp');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Link to={`/teacher/classes/${cls.id}`}>
      <Card className="group overflow-hidden border-border transition-colors hover:border-primary/40">
        <div className="h-2" style={{ backgroundColor: cls.coverColor }} />
        <CardContent className="p-5">
          <div className="mb-3 flex items-start justify-between">
            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
              {cls.name}
            </h3>
            <button
              onClick={copyCode}
              className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Sao chép mã lớp"
            >
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {cls.classCode}
            </button>
          </div>
          {cls.description && (
            <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{cls.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> {cls.studentCount} học sinh
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> {cls.topicCount} chủ đề
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function TeacherClassesPage() {
  const { data: classes, isLoading } = useTeacherClasses();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lớp học</h1>
          <p className="mt-1 text-sm text-muted-foreground">Quản lý lớp học của bạn</p>
        </div>
        <CreateClassDialog onCreated={() => {}} />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse border-border bg-card" />
          ))}
        </div>
      ) : !classes?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium text-foreground">Chưa có lớp học nào</p>
          <p className="mt-1 text-sm text-muted-foreground">Tạo lớp học đầu tiên để bắt đầu</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} />
          ))}
        </div>
      )}
    </div>
  );
}
