import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesService } from '@/services/classes.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { UserPlus, Trash2, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

export function StudentsTab({ classId }: { classId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);

  const { data: students, isLoading } = useQuery({
    queryKey: ['class-students', classId, search],
    queryFn: () => classesService.getStudents(classId, search || undefined),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['class-students', classId] });

  const addMutation = useMutation({
    mutationFn: () => classesService.addStudent(classId, email),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['class-detail', classId] });
      toast.success('Đã thêm học sinh');
      setAddOpen(false);
      setEmail('');
    },
    onError: () => toast.error('Thêm học sinh thất bại. Kiểm tra lại email.'),
  });

  const removeMutation = useMutation({
    mutationFn: (studentId: string) => classesService.removeStudent(classId, studentId),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['class-detail', classId] });
      toast.success('Đã xóa học sinh');
      setRemoveId(null);
    },
    onError: () => toast.error('Xóa thất bại'),
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={() => { setEmail(''); setAddOpen(true); }}>
          <UserPlus className="h-4 w-4" /> Thêm
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-16 animate-pulse border-border bg-card" />
          ))}
        </div>
      ) : !students?.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-foreground">Chưa có học sinh</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Chia sẻ mã lớp hoặc thêm học sinh bằng email
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((s) => (
            <Card key={s.userId} className="border-border">
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary shrink-0">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="hidden sm:flex items-center gap-2">
                    {s.entryTestCompleted ? (
                      <Badge variant="secondary">Đã test</Badge>
                    ) : (
                      <Badge variant="outline">Chưa test</Badge>
                    )}
                    <div className="w-24 flex items-center gap-2">
                      <Progress value={s.completionPercent} className="h-1.5" />
                      <span className="text-xs text-muted-foreground w-8">{s.completionPercent}%</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => setRemoveId(s.userId)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add student dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm học sinh</DialogTitle>
            <DialogDescription>Nhập email học sinh đã đăng ký trên hệ thống</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Email học sinh</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addMutation.isPending || !email.trim()}>
                {addMutation.isPending ? 'Đang thêm...' : 'Thêm'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={!!removeId} onOpenChange={() => setRemoveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa học sinh</DialogTitle>
            <DialogDescription>Học sinh sẽ bị xóa khỏi lớp. Bạn có chắc?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveId(null)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={() => removeId && removeMutation.mutate(removeId)}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
