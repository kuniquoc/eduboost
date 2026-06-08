import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { topicsService } from '@/services/topics.service';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Sparkles } from 'lucide-react';
import type { DocumentDto } from '@/types';

interface QuizGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: DocumentDto | null;
  onSubmit: (options: {
    topicId?: string;
    numQuestions: number;
    difficulty: string;
    mode: string;
    numEasyQuestions?: number;
    numMediumQuestions?: number;
    numHardQuestions?: number;
  }) => void;
  isPending: boolean;
  classId?: string;
}

export function QuizGenerationDialog({
  open,
  onOpenChange,
  doc,
  onSubmit,
  isPending,
  classId,
}: QuizGenerationDialogProps) {
  const [topicId, setTopicId] = useState<string>('none');
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [mode, setMode] = useState<string>('create');

  // Advanced Mode states
  const [isAdvanced, setIsAdvanced] = useState<boolean>(false);
  const [easyCount, setEasyCount] = useState<number>(0);
  const [mediumCount, setMediumCount] = useState<number>(0);
  const [hardCount, setHardCount] = useState<number>(0);

  // Load topics if classId is provided
  const { data: topics } = useQuery({
    queryKey: ['class-topics', classId],
    queryFn: () => topicsService.getTopics(classId!),
    enabled: !!classId && open,
  });

  useEffect(() => {
    if (open) {
      if (doc?.topicId) {
        setTopicId(doc.topicId);
      } else {
        setTopicId('none');
      }
      setNumQuestions(10);
      setDifficulty('medium');
      setIsAdvanced(false);
      setEasyCount(0);
      setMediumCount(0);
      setHardCount(0);
      if (doc?.generatedQuizId) {
        setMode('append');
      } else {
        setMode('create');
      }
    }
  }, [open, doc]);

  const handleSubmit = () => {
    const totalCount = isAdvanced ? (easyCount + mediumCount + hardCount) : numQuestions;
    if (totalCount <= 0) return;

    onSubmit({
      topicId: topicId === 'none' ? undefined : topicId,
      numQuestions: totalCount,
      difficulty: isAdvanced ? 'mixed' : difficulty,
      mode: doc?.status === 'error' ? 'retry' : mode,
      numEasyQuestions: isAdvanced ? easyCount : undefined,
      numMediumQuestions: isAdvanced ? mediumCount : undefined,
      numHardQuestions: isAdvanced ? hardCount : undefined,
    });
  };

  const totalAdvancedQuestions = easyCount + mediumCount + hardCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Sinh Quiz từ tài liệu
          </DialogTitle>
          <DialogDescription>
            Tùy chỉnh các thông số để AI sinh bộ câu hỏi tối ưu nhất từ <strong>{doc?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Class topic selection (only for teachers/class scope docs) */}
          {classId && (
            <div className="space-y-2">
              <Label htmlFor="topic">Chủ đề liên kết (Lớp học)</Label>
              <Select value={topicId} onValueChange={(v) => setTopicId(v || 'none')}>
                <SelectTrigger id="topic" className="w-full">
                  <SelectValue placeholder="Chọn chủ đề..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không liên kết chủ đề</SelectItem>
                  {topics?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.difficulty})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Configuration Mode Toggle */}
          <div className="flex rounded-lg bg-muted p-1 text-xs">
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 text-center font-medium transition-all cursor-pointer ${
                !isAdvanced ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setIsAdvanced(false)}
            >
              Cấu hình nhanh
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-1.5 text-center font-medium transition-all cursor-pointer ${
                isAdvanced ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setIsAdvanced(true)}
            >
              Tùy chỉnh độ khó
            </button>
          </div>

          {isAdvanced ? (
            /* Advanced Mode: count input per difficulty */
            <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/20">
              <p className="text-xs text-muted-foreground mb-2">Nhập số lượng câu hỏi mong muốn cho mỗi độ khó:</p>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="easyCount" className="text-xs">Dễ (Easy)</Label>
                  <input
                    id="easyCount"
                    type="number"
                    min="0"
                    max="20"
                    className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={easyCount}
                    onChange={(e) => setEasyCount(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="mediumCount" className="text-xs">Trung bình</Label>
                  <input
                    id="mediumCount"
                    type="number"
                    min="0"
                    max="20"
                    className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={mediumCount}
                    onChange={(e) => setMediumCount(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hardCount" className="text-xs">Khó (Hard)</Label>
                  <input
                    id="hardCount"
                    type="number"
                    min="0"
                    max="20"
                    className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={hardCount}
                    onChange={(e) => setHardCount(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div className="mt-2 text-right">
                <span className="text-xs font-medium text-foreground">
                  Tổng số câu: <strong className="text-primary">{totalAdvancedQuestions}</strong> câu
                </span>
              </div>
            </div>
          ) : (
            /* Simple Mode: unified question count & difficulty */
            <>
              {/* Number of questions */}
              <div className="space-y-2">
                <Label htmlFor="numQuestions">Số lượng câu hỏi</Label>
                <Select value={numQuestions.toString()} onValueChange={(v) => setNumQuestions(parseInt(v || '10'))}>
                  <SelectTrigger id="numQuestions" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 câu</SelectItem>
                    <SelectItem value="10">10 câu (Khuyên dùng)</SelectItem>
                    <SelectItem value="15">15 câu</SelectItem>
                    <SelectItem value="20">20 câu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <Label htmlFor="difficulty">Độ khó câu hỏi</Label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v || 'medium')}>
                  <SelectTrigger id="difficulty" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Dễ (Easy)</SelectItem>
                    <SelectItem value="medium">Trung bình (Medium)</SelectItem>
                    <SelectItem value="hard">Khó (Hard)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Mode (Create vs Append) */}
          {doc?.generatedQuizId && doc.status !== 'error' && (
            <div className="space-y-2">
              <Label htmlFor="mode">Chế độ sinh câu hỏi</Label>
              <Select value={mode} onValueChange={(v) => setMode(v || 'create')}>
                <SelectTrigger id="mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-w-[400px]">
                  <SelectItem value="append">Sinh thêm câu hỏi mới (giữ quiz cũ)</SelectItem>
                  <SelectItem value="create">Tạo lại toàn bộ (ghi đè quiz cũ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {doc?.status === 'error' && (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              * Lượt tạo quiz trước của tài liệu này đã thất bại. AI sẽ tự động kích hoạt chế độ <strong>thử sinh lại (retry)</strong>.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || (isAdvanced && totalAdvancedQuestions === 0)}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {doc?.status === 'error' ? 'Thử sinh lại' : mode === 'append' ? 'Sinh thêm câu' : 'Tạo mới Quiz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
