import { useQuery } from '@tanstack/react-query';
import { classesService } from '@/features/classes/api/classes.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Users, GraduationCap } from 'lucide-react';
import type { ClassDetailDto } from '@/features/classes/types';

export function StudentInfoTab({
  classId,
  classDetail,
}: {
  classId: string;
  classDetail: ClassDetailDto;
}) {
  const { data: classmates = [], isLoading } = useQuery({
    queryKey: ['classmates', classId],
    queryFn: () => classesService.getClassmates(classId),
    enabled: !!classId,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin lớp học</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Giảng viên:</span>
            <span className="font-medium">{classDetail.teacherName ?? '—'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{classDetail.studentCount} học sinh</Badge>
            <Badge variant="outline">{classDetail.topicCount} chủ đề</Badge>
            <Badge variant="outline">Mã lớp: {classDetail.classCode}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Danh sách học sinh
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-24 animate-pulse rounded bg-muted" />
          ) : classmates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có học sinh nào trong lớp.</p>
          ) : (
            <ul className="divide-y divide-border">
              {classmates.map((s) => (
                <li key={s.studentId} className="flex items-center gap-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {s.avatar?.slice(0, 2).toUpperCase() ?? s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{s.name}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
