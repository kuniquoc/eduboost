import { ArrowRight, CheckCircle2, Library, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { cn } from '@/shared/lib/utils';

export type StudentPoolTab = 'pool' | 'revision' | 'generate';

export function PoolDashboardHeader({
  activeTab,
  onTabChange,
}: {
  activeTab: StudentPoolTab;
  onTabChange: (tab: StudentPoolTab) => void;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
          AI Quiz Pool cá nhân
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tự xây dựng kho kiến thức ôn luyện cá nhân hóa, bám sát tài liệu bài học của bạn.
        </p>
      </div>
      <div className="flex rounded-xl bg-muted/60 p-1 border border-border/50 max-w-fit">
        <Button variant={activeTab === 'pool' ? 'default' : 'ghost'} onClick={() => onTabChange('pool')} className="rounded-lg text-xs md:text-sm font-medium">
          <Library className="mr-2 h-4 w-4" /> Kho Pool cá nhân
        </Button>
        <Button variant={activeTab === 'revision' ? 'default' : 'ghost'} onClick={() => onTabChange('revision')} className="rounded-lg text-xs md:text-sm font-medium">
          <Trophy className="mr-2 h-4 w-4" /> Bộ ôn tập của tôi
        </Button>
        <Button variant={activeTab === 'generate' ? 'default' : 'ghost'} onClick={() => onTabChange('generate')} className="rounded-lg text-xs md:text-sm font-medium">
          <Sparkles className="mr-2 h-4 w-4" /> Tự sinh câu hỏi AI
        </Button>
      </div>
    </div>
  );
}

export function RevisionSelectionBar({
  count,
  onClear,
  onCreate,
}: {
  count: number;
  onClear: () => void;
  onCreate: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-[90%] max-w-2xl bg-card/90 backdrop-blur-md border border-indigo-500/45 rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4 animate-slideUp">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <p className="font-bold text-sm">Đã chọn {count} đợt câu hỏi</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Lập Bộ ôn tập để luyện thi tập trung cho kì thi sắp tới!</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onClear} className="text-xs hover:bg-muted">Hủy</Button>
        <Button size="sm" onClick={onCreate} className="bg-indigo-600 hover:bg-indigo-700 text-primary-foreground text-xs font-semibold shadow-md shadow-indigo-500/10">
          Lập bộ ôn tập <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function RevisionSetDialog({
  open,
  count,
  title,
  pending,
  onOpenChange,
  onTitleChange,
  onSubmit,
}: {
  open: boolean;
  count: number;
  title: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (title: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-indigo-600" />Tạo bộ ôn tập tập trung</DialogTitle>
          <DialogDescription>Hệ thống sẽ tổng hợp câu hỏi từ {count} đợt sinh đã chọn tạo thành một Bộ ôn tập riêng tư.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Tên Bộ ôn tập</Label>
            <Input placeholder="Ví dụ: Ôn thi cuối kỳ môn Toán, Tổng ôn Sử chương 3..." value={title} onChange={(event) => onTitleChange(event.target.value)} className="bg-muted/30 focus-visible:ring-indigo-500" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-primary-foreground font-semibold" onClick={onSubmit} disabled={pending}>
            {pending ? 'Đang tạo...' : 'Tạo bộ ôn tập'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GenerationProgressOverlay({ step }: { step: number }) {
  const steps = [
    'Đọc tài liệu và hiểu ngữ cảnh...',
    'Phân tích cây kiến thức & tìm lỗ hổng...',
    'Soạn thảo câu hỏi trắc nghiệm & giải thích...',
    'Đang chuẩn hóa định dạng Quiz Pool...',
  ];
  return (
    <div className="fixed inset-0 bg-background/85 backdrop-blur-md z-50 flex items-center justify-center animate-fadeIn p-4">
      <Card className="max-w-md w-full border-indigo-500/30 bg-card/90 shadow-2xl p-6 text-center space-y-6">
        <div className="relative mx-auto h-20 w-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <Sparkles className="h-8 w-8 text-indigo-600 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold">Gia sư AI đang soạn câu hỏi</h3>
          <p className="text-xs text-muted-foreground">Quá trình phân tích tài liệu và cấu trúc câu hỏi có thể mất khoảng 20-40 giây.</p>
        </div>
        <div className="space-y-3.5 max-w-xs mx-auto text-left">
          {steps.map((label, index) => {
            const active = step === index;
            const completed = step > index;
            return (
              <div key={label} className="flex items-center gap-3 transition-opacity duration-300">
                <div className={cn('h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0', completed ? 'bg-green-600 text-primary-foreground' : active ? 'bg-indigo-600 text-primary-foreground animate-pulse' : 'bg-muted text-muted-foreground')}>
                  {completed ? '✓' : index + 1}
                </div>
                <span className={cn('text-xs', active ? 'text-indigo-700 font-semibold' : completed ? 'text-green-700' : 'text-muted-foreground/60')}>{label}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
