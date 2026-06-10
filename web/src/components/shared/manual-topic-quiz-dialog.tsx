import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { poolService } from '@/services/pool.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { QuizDto } from '@/types';

interface DocumentOption {
  id: string;
  name: string;
}

export interface ManualTopicQuizFormProps {
  topicName: string;
  topicNameReadonly?: boolean;
  topicDescription?: string;
  classId?: string;
  topicId?: string;
  defaultDifficulty?: 'easy' | 'medium' | 'hard';
  availableDocuments?: DocumentOption[];
  selectedDocumentId?: string;
  onSelectedDocumentIdChange?: (documentId: string) => void;
  onUploadDocument?: (file: File) => Promise<string | undefined>;
  uploadingDocument?: boolean;
  documentPickerDisabled?: boolean;
  documentSectionHint?: string;
  onSuccess: (quiz: QuizDto) => void;
  onCancel?: () => void;
  submitLabel?: string;
  variant?: 'dialog' | 'inline';
}

export function ManualTopicQuizForm({
  topicName: initialTopicName,
  topicNameReadonly = false,
  topicDescription = '',
  classId,
  topicId,
  defaultDifficulty = 'medium',
  availableDocuments = [],
  selectedDocumentId,
  onSelectedDocumentIdChange,
  onUploadDocument,
  uploadingDocument = false,
  documentPickerDisabled = false,
  documentSectionHint,
  onSuccess,
  onCancel,
  submitLabel = 'Sinh Quiz với AI',
  variant = 'inline',
}: ManualTopicQuizFormProps) {
  const [topicName, setTopicName] = useState(initialTopicName);
  const [userSuggestion, setUserSuggestion] = useState(topicDescription);
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(defaultDifficulty);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [easyCount, setEasyCount] = useState(0);
  const [mediumCount, setMediumCount] = useState(5);
  const [hardCount, setHardCount] = useState(0);
  const [genMode, setGenMode] = useState<'append' | 'replace'>('append');
  const [showGenOverlay, setShowGenOverlay] = useState(false);
  const [generatingStep, setGeneratingStep] = useState(0);
  const [internalDocumentId, setInternalDocumentId] = useState(selectedDocumentId ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasDocumentSource = availableDocuments.length > 0 || Boolean(onUploadDocument);
  const effectiveDocumentId = selectedDocumentId ?? internalDocumentId;

  const handleDocumentChange = (documentId: string) => {
    if (onSelectedDocumentIdChange) {
      onSelectedDocumentIdChange(documentId);
    } else {
      setInternalDocumentId(documentId);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadDocument) return;

    try {
      const uploadedDocumentId = await onUploadDocument(file);
      if (uploadedDocumentId) {
        handleDocumentChange(uploadedDocumentId);
      }
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const generateMutation = useMutation({
    mutationFn: () => {
      const totalAdvanced = easyCount + mediumCount + hardCount;
      const trimmedSuggestion = userSuggestion.trim();
      return poolService.generatePoolQuiz({
        topicId,
        topicName: topicName.trim(),
        classId: classId || undefined,
        userSuggestion: trimmedSuggestion || undefined,
        documentId: effectiveDocumentId || undefined,
        numQuestions: isAdvanced ? totalAdvanced : numQuestions,
        difficulty: isAdvanced ? 'mixed' : difficulty,
        mode: genMode,
        numEasyQuestions: isAdvanced ? easyCount : undefined,
        numMediumQuestions: isAdvanced ? mediumCount : undefined,
        numHardQuestions: isAdvanced ? hardCount : undefined,
      });
    },
    onSuccess: (quiz) => {
      setShowGenOverlay(false);
      setGeneratingStep(0);
      onSuccess(quiz);
    },
    onError: (err: unknown) => {
      setShowGenOverlay(false);
      setGeneratingStep(0);
      const message = (err as { response?: { data?: { message?: string } }; message?: string })
        .response?.data?.message
        ?? (err as { message?: string }).message
        ?? 'Sinh quiz thất bại';
      toast.error(message);
    },
  });

  const handleGenerate = () => {
    if (!topicName.trim()) {
      toast.error('Vui lòng nhập tên chủ đề');
      return;
    }
    if (!userSuggestion.trim() && !effectiveDocumentId) {
      toast.error('Vui lòng nhập gợi ý nội dung hoặc chọn tài liệu');
      return;
    }

    setShowGenOverlay(true);
    setGeneratingStep(1);

    const interval = setInterval(() => {
      setGeneratingStep((prev) => {
        if (prev < 3) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 4500);

    generateMutation.mutate();
  };

  const formContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Tên chủ đề</Label>
        <Input
          placeholder="Ví dụ: Công thức Toán đại số, Bất đẳng thức Cauchy..."
          value={topicName}
          onChange={(e) => setTopicName(e.target.value)}
          readOnly={topicNameReadonly}
          className={cn('bg-muted/30 focus-visible:ring-indigo-500', topicNameReadonly && 'opacity-80')}
        />
        {!topicNameReadonly && (
          <p className="text-[10px] text-muted-foreground italic">
            * Nhập trùng tên chủ đề để sinh thêm, hoặc chọn chế độ "Thay thế" để tạo lại.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Mô tả / gợi ý nội dung cần sinh (Tùy chọn)</Label>
        <Textarea
          placeholder="Ví dụ: Tạo 10 câu hỏi trắc nghiệm về phương trình bậc 2 và bất phương trình kèm giải thích dễ hiểu..."
          value={userSuggestion}
          onChange={(e) => setUserSuggestion(e.target.value)}
          rows={4}
          className="bg-muted/30 focus-visible:ring-indigo-500"
        />
        <p className="text-[10px] text-muted-foreground italic">
          * Có thể để trống nếu bạn đã chọn tài liệu.
        </p>
      </div>

      {hasDocumentSource && (
        <div className="space-y-3 animate-fadeIn">
          <Label className="text-sm font-semibold">Chọn tài liệu học tập (Tùy chọn)</Label>
          <div className="flex gap-2">
            <select
              value={effectiveDocumentId}
              onChange={(e) => handleDocumentChange(e.target.value)}
              disabled={documentPickerDisabled}
              className="flex-1 flex h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">-- Chọn tài liệu --</option>
              {availableDocuments.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.name}</option>
              ))}
            </select>
            {onUploadDocument && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.md"
                  onChange={handleUploadDocument}
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingDocument || documentPickerDisabled}
                >
                  {uploadingDocument ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Tải lên
                </Button>
              </>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            {documentSectionHint ?? '* Có thể chọn đồng thời tài liệu và gợi ý nội dung. Cần tối thiểu một trong hai nguồn.'}
          </p>
        </div>
      )}

      {/* Difficulty & Number of Questions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Độ khó & Số lượng câu</Label>
          <button
            type="button"
            onClick={() => setIsAdvanced(!isAdvanced)}
            className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
          >
            {isAdvanced ? 'Cấu hình nhanh' : 'Tùy chỉnh theo độ khó'}
          </button>
        </div>

        {isAdvanced ? (
          <div className="rounded-lg border border-border p-3 bg-muted/20 space-y-3">
            <p className="text-xs text-muted-foreground">Nhập số câu mong muốn cho từng mức độ:</p>
            <div className="grid grid-cols-3 gap-3">
              {([['easy', 'Dễ', easyCount, setEasyCount], ['medium', 'Trung bình', mediumCount, setMediumCount], ['hard', 'Khó', hardCount, setHardCount]] as const).map(([key, label, val, setter]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <input
                    type="number" min={0} max={20} value={val}
                    onChange={(e) => setter(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full h-9 rounded-md border border-input bg-muted/30 px-3 text-sm text-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
            <div className="text-right text-xs font-medium">
              Tổng: <strong className="text-indigo-400">{easyCount + mediumCount + hardCount}</strong> câu
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Mức độ</Label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-indigo-500"
              >
                <option value="easy">Dễ (Cơ bản)</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó (Nâng cao)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Số câu</Label>
              <Input
                type="number" min={1} max={50} value={numQuestions}
                onChange={(e) => setNumQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                className="bg-muted/30 focus-visible:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Append / Replace mode */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Chế độ sinh câu hỏi</Label>
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => setGenMode('append')}
            className={cn(
              'cursor-pointer rounded-xl p-3 border text-center text-xs transition-all duration-300',
              genMode === 'append'
                ? 'border-indigo-500/50 bg-indigo-500/5 font-semibold text-indigo-300'
                : 'border-border/40 hover:bg-muted/40 text-muted-foreground'
            )}
          >
            <div className="font-semibold mb-0.5">Sinh thêm</div>
            <div className="text-[10px] opacity-70">Giữ câu cũ, thêm câu mới</div>
          </div>
          <div
            onClick={() => setGenMode('replace')}
            className={cn(
              'cursor-pointer rounded-xl p-3 border text-center text-xs transition-all duration-300',
              genMode === 'replace'
                ? 'border-rose-500/50 bg-rose-500/5 font-semibold text-rose-300'
                : 'border-border/40 hover:bg-muted/40 text-muted-foreground'
            )}
          >
            <div className="font-semibold mb-0.5">Thay thế</div>
            <div className="text-[10px] opacity-70">Xoá câu cũ, sinh câu hỏi mới</div>
          </div>
        </div>
        {genMode === 'replace' && (
          <p className="text-[10px] text-rose-400/80 italic">
            ⚠ Chế độ thay thế sẽ xoá toàn bộ câu hỏi của bạn trong chủ đề này.
          </p>
        )}
      </div>

      <div className={cn('flex gap-2', variant === 'dialog' ? 'justify-end' : '')}>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={generateMutation.isPending}>
            Hủy
          </Button>
        )}
        <Button
          className={cn(
            variant === 'inline' && 'w-full bg-gradient-to-r from-blue-500 via-indigo-600 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white font-semibold py-6 rounded-xl shadow-lg shadow-indigo-500/20',
            variant === 'dialog' && 'bg-indigo-600 hover:bg-indigo-700',
          )}
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Gia sư AI đang chuẩn bị câu hỏi...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {formContent}

      {showGenOverlay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center animate-fadeIn p-4">
          <Card className="max-w-md w-full border-indigo-500/30 bg-card/90 shadow-2xl p-6 text-center space-y-6">
            <div className="relative mx-auto h-20 w-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <Sparkles className="h-8 w-8 text-indigo-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold">Gia sư AI đang soạn câu hỏi</h3>
              <p className="text-xs text-muted-foreground">
                Quá trình có thể mất khoảng 20-40 giây. AI sẽ kết hợp gợi ý và tài liệu (nếu có).
              </p>
            </div>

            <div className="space-y-3.5 max-w-xs mx-auto text-left">
              {[
                'Phân tích chủ đề và gợi ý của bạn...',
                'Xây dựng cây kiến thức liên quan...',
                'Soạn thảo câu hỏi trắc nghiệm & giải thích...',
                'Chuẩn hóa định dạng quiz...',
              ].map((step, idx) => {
                const isActive = generatingStep === idx;
                const isCompleted = generatingStep > idx;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={cn(
                      'h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                      isCompleted ? 'bg-green-500 text-black' : isActive ? 'bg-indigo-500 text-white animate-pulse' : 'bg-muted text-muted-foreground',
                    )}>
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <span className={cn(
                      'text-xs',
                      isActive ? 'text-indigo-300 font-semibold' : isCompleted ? 'text-green-400' : 'text-muted-foreground/60',
                    )}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

interface ManualTopicQuizDialogProps extends Omit<ManualTopicQuizFormProps, 'variant' | 'onCancel'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualTopicQuizDialog({
  open,
  onOpenChange,
  onSuccess,
  ...formProps
}: ManualTopicQuizDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            AI sinh câu hỏi từ chủ đề
          </DialogTitle>
          <DialogDescription>
            Nhập gợi ý nội dung và/hoặc chọn tài liệu. AI sẽ tạo câu hỏi trắc nghiệm theo dữ liệu bạn cung cấp.
          </DialogDescription>
        </DialogHeader>

        <ManualTopicQuizForm
          {...formProps}
          variant="dialog"
          onCancel={() => onOpenChange(false)}
          onSuccess={(quiz) => {
            onOpenChange(false);
            onSuccess(quiz);
          }}
        />

        <DialogFooter className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
