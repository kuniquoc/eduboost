import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { classesService } from '@/services/classes.service';
import { useEnrolledClasses } from '@/hooks/use-enrolled-classes';
import { useStudentProgress } from '@/hooks/use-student-progress';
import { placementTestPath } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { LogIn, Users, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import type { ClassDto } from '@/types';

function ClassCard({ cls, entryTestCompleted }: { cls: ClassDto; entryTestCompleted: boolean }) {
  const href = entryTestCompleted
    ? `/student/classes/${cls.id}`
    : placementTestPath(cls.id);

  return (
    <Link to={href}>
      <Card className="group overflow-hidden border-border transition-colors hover:border-primary/40">
        <div className="h-2" style={{ backgroundColor: cls.coverColor }} />
        <CardContent className="p-5">
          <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
            {cls.name}
          </h3>
          {cls.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{cls.description}</p>
          )}
          <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> {cls.studentCount} bạn học
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

export function StudentClassesPage() {
  const queryClient = useQueryClient();
  const [joinOpen, setJoinOpen] = useState(false);
  const [classCode, setClassCode] = useState('');

  const { data: classes, isLoading } = useEnrolledClasses();
  const { data: progress } = useStudentProgress();

  const entryTestMap = new Map(
    progress?.enrolledClasses.map((c) => [c.classId, c.entryTestCompleted]) ?? [],
  );

  const joinMutation = useMutation({
    mutationFn: () => classesService.joinClass(classCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrolled-classes'] });
      queryClient.invalidateQueries({ queryKey: ['student-progress'] });
      toast.success('Tham gia lớp thành công!');
      setJoinOpen(false);
      setClassCode('');
    },
    onError: () => toast.error('Mã lớp không hợp lệ hoặc đã tham gia'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lớp học</h1>
          <p className="mt-1 text-sm text-muted-foreground">Các lớp bạn đang tham gia</p>
        </div>
        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogTrigger render={<Button />}>
            <LogIn className="h-4 w-4" /> Tham gia lớp
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tham gia lớp học</DialogTitle>
              <DialogDescription>Nhập mã lớp từ giáo viên</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); joinMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Mã lớp</Label>
                <Input
                  placeholder="VD: ABC123"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  required
                  maxLength={10}
                  className="text-center text-lg font-mono tracking-widest"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={joinMutation.isPending || !classCode.trim()}>
                  {joinMutation.isPending ? 'Đang tham gia...' : 'Tham gia'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-36 animate-pulse border-border bg-card" />
          ))}
        </div>
      ) : !classes?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <BookOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium text-foreground">Chưa tham gia lớp nào</p>
          <p className="mt-1 text-sm text-muted-foreground">Nhập mã lớp từ giáo viên để bắt đầu</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} entryTestCompleted={entryTestMap.get(cls.id) ?? false} />
          ))}
        </div>
      )}
    </div>
  );
}
