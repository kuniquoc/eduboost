import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { poolService } from '@/services/pool.service';
import { documentsService } from '@/services/documents.service';
import { useTeacherClasses } from '@/hooks/use-teacher-classes';
import { useClassDocuments } from '@/hooks/use-class-documents';
import { useClassTopics } from '@/hooks/use-class-topics';
import { ManualTopicQuizForm } from '@/components/shared/manual-topic-quiz-dialog';
import { PoolQuestionPicker } from '@/components/shared/pool-question-picker';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import {
  Sparkles, CheckCircle2, Library, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

export function TeacherPoolDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pool' | 'generate'>('pool');

  const [selectedPoolQuizIds, setSelectedPoolQuizIds] = useState<string[]>([]);

  // Generate states
  const [topicName, setTopicName] = useState('');
  const [selectedClassTopicId, setSelectedClassTopicId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedClassIdForTopic, setSelectedClassIdForTopic] = useState(searchParams.get('classId') ?? '');
  const [lastGeneratedQuizId, setLastGeneratedQuizId] = useState<string | null>(null);

  // Create Test Dialog states
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testTitle, setTestTitle] = useState('');
  const [selectedClassIdForTest, setSelectedClassIdForTest] = useState('');
  const [timeLimit, setTimeLimit] = useState(45);
  const [totalScore, setTotalScore] = useState(10);

  const { data: classes = [] } = useTeacherClasses();
  const { data: classDocuments = [] } = useClassDocuments(selectedClassIdForTopic);
  const { data: classTopics = [] } = useClassTopics(selectedClassIdForTopic || undefined, !!selectedClassIdForTopic);

  useEffect(() => {
    const classIdFromUrl = searchParams.get('classId');
    const topicIdFromUrl = searchParams.get('topicId');
    const documentIdFromUrl = searchParams.get('documentId');
    const tabFromUrl = searchParams.get('tab');

    if (tabFromUrl === 'generate' || classIdFromUrl || topicIdFromUrl || documentIdFromUrl) {
      setActiveTab('generate');
    }
    if (classIdFromUrl) {
      setSelectedClassIdForTopic(classIdFromUrl);
    }
    if (documentIdFromUrl) {
      setSelectedDocId(documentIdFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    const topicIdFromUrl = searchParams.get('topicId');
    if (!topicIdFromUrl || classTopics.length === 0) return;
    const topic = classTopics.find((t) => t.id === topicIdFromUrl);
    if (topic) {
      setSelectedClassTopicId(topic.id);
      setTopicName(topic.name);
    }
  }, [searchParams, classTopics]);

  const handleClassTopicSelect = (topicId: string) => {
    setSelectedClassTopicId(topicId);
    if (!topicId) {
      setTopicName('');
      return;
    }
    const topic = classTopics.find((t) => t.id === topicId);
    if (topic) {
      setTopicName(topic.name);
    }
  };

  const handleManualQuizSuccess = (quiz: { id: string; questionCount: number }) => {
    setLastGeneratedQuizId(quiz.id);
    toast.success(`Đã tạo thành công ${quiz.questionCount} câu hỏi vào Quiz Pool!`, {
      action: {
        label: 'Kiểm tra ngay',
        onClick: () => navigate(`/teacher/ai-studio/${quiz.id}`),
      },
    });
    queryClient.invalidateQueries({ queryKey: ['pool-topics'] });
    setTopicName('');
    setSelectedClassTopicId('');
    setActiveTab('pool');
  };

  // Presigned document upload helper
  const handleUploadFile = async (file: File) => {
    if (!file) return;

    if (!selectedClassIdForTopic) {
      toast.error('Vui lòng chọn lớp học trước khi tải tài liệu');
      return;
    }

    setUploadingFile(true);
    try {
      const { uploadUrl, documentId } = await documentsService.requestClassUploadUrl(selectedClassIdForTopic, {
        fileName: file.name,
        fileSize: file.size.toString(),
        topicId: selectedClassTopicId || undefined,
      });

      await documentsService.uploadFileToMinio(uploadUrl, file);
      await documentsService.confirmClassUpload(selectedClassIdForTopic, documentId);

      queryClient.invalidateQueries({ queryKey: ['class-documents', selectedClassIdForTopic] });
      setSelectedDocId(documentId);
      toast.success(`Đã tải lên tài liệu ${file.name} thành công!`);
      return documentId;
    } catch (err: unknown) {
      const message = (err as { message?: string }).message ?? 'Tải tài liệu lên thất bại';
      toast.error(message);
      return undefined;
    } finally {
      setUploadingFile(false);
    }
  };

  // Create Test mutation
  const createTestMutation = useMutation({
    mutationFn: (payload: any) => poolService.createTestFromPool(payload),
    onSuccess: () => {
      setIsTestDialogOpen(false);
      setTestTitle('');
      setSelectedClassIdForTest('');
      setSelectedPoolQuizIds([]);
      toast.success('Đã tạo đề thi và xuất bản lên lớp học thành công!');
    },
    onError: (err: any) => {
      toast.error('Tạo đề thi thất bại: ' + err.message);
    }
  });

  const handleCreateTest = () => {
    if (!testTitle.trim()) {
      toast.error('Vui lòng nhập tên đề thi');
      return;
    }
    if (!selectedClassIdForTest) {
      toast.error('Vui lòng chọn lớp học áp dụng');
      return;
    }

    createTestMutation.mutate({
      title: testTitle.trim(),
      classId: selectedClassIdForTest,
      poolQuizIds: selectedPoolQuizIds,
      timeLimitMinutes: timeLimit,
      totalScore: totalScore
    });
  };

  return (
    <div className="relative min-h-[85vh] text-foreground">
      {/* Dynamic Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            AI Quiz Pool Studio
          </h1>
        </div>
        <div className="flex rounded-xl bg-muted/60 p-1 border border-border/50 max-w-fit">
          <Button
            variant={activeTab === 'pool' ? 'default' : 'ghost'}
            className="rounded-lg text-xs md:text-sm font-medium"
            onClick={() => setActiveTab('pool')}
          >
            <Library className="mr-2 h-4 w-4" /> Kho Quiz Pool
          </Button>
          <Button
            variant={activeTab === 'generate' ? 'default' : 'ghost'}
            className="rounded-lg text-xs md:text-sm font-medium"
            onClick={() => setActiveTab('generate')}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Sinh Quiz AI mới
          </Button>
        </div>
      </div>

      {activeTab === 'pool' ? (
        <div className="space-y-4">
          {lastGeneratedQuizId && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/teacher/ai-studio/${lastGeneratedQuizId}`)}
              >
                Kiểm tra quiz vừa tạo trong AI Studio
              </Button>
            </div>
          )}
          <PoolQuestionPicker
            selectionMode="batch"
            selectedQuestionIds={[]}
            selectedPoolQuizIds={selectedPoolQuizIds}
            onSelectionChange={({ poolQuizIds }) => setSelectedPoolQuizIds(poolQuizIds)}
            showDeleteButton
            enableTopicRename
          />
        </div>
      ) : (
        /* GENERATE TAB - AI CREATOR */
        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-xl max-w-2xl mx-auto">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-border/50 pb-3">
              <Sparkles className="h-5 w-5 text-purple-400" />
              <h2 className="text-xl font-bold">Sinh câu hỏi thông minh bằng AI</h2>
            </div>

            {/* Class association (Optional) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Gắn chủ đề vào lớp học (Tùy chọn)</Label>
              <select
                value={selectedClassIdForTopic}
                onChange={(e) => {
                  setSelectedClassIdForTopic(e.target.value);
                  setSelectedClassTopicId('');
                  setSelectedDocId('');
                }}
                className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">-- Lưu làm chủ đề cá nhân (Chỉ mình bạn thấy) --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {selectedClassIdForTopic && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Chọn chủ đề có sẵn trong lớp (Tùy chọn)</Label>
                <select
                  value={selectedClassTopicId}
                  onChange={(e) => handleClassTopicSelect(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-purple-500"
                >
                  <option value="">-- Nhập chủ đề mới bên dưới --</option>
                  {classTopics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.difficulty})</option>
                  ))}
                </select>
              </div>
            )}
            <ManualTopicQuizForm
              key={`${selectedClassIdForTopic || 'private'}-${selectedClassTopicId || 'new'}-${topicName}`}
              topicName={topicName}
              topicNameReadonly={!!selectedClassTopicId}
              classId={selectedClassIdForTopic || undefined}
              topicId={selectedClassTopicId || undefined}
              defaultDifficulty={classTopics.find((t) => t.id === selectedClassTopicId)?.difficulty ?? 'medium'}
              availableDocuments={selectedClassIdForTopic ? classDocuments.map((doc) => ({ id: doc.id, name: doc.name })) : []}
              selectedDocumentId={selectedDocId}
              onSelectedDocumentIdChange={setSelectedDocId}
              onUploadDocument={selectedClassIdForTopic ? handleUploadFile : undefined}
              uploadingDocument={uploadingFile}
              documentPickerDisabled={!selectedClassIdForTopic}
              documentSectionHint={
                selectedClassIdForTopic
                  ? '* Hỗ trợ PDF, TXT, DOCX. Có thể chọn đồng thời tài liệu và gợi ý nội dung.'
                  : 'Chọn lớp học ở trên để xem/tải tài liệu lớp. Bạn vẫn có thể sinh quiz chỉ với gợi ý nội dung.'
              }
              onSuccess={handleManualQuizSuccess}
              submitLabel="Sinh Quiz với AI"
            />

          </CardContent>
        </Card>
      )}

      {/* FLOATING ACTION BOTTOM PANEL - CREATE TEST BAR */}
      {selectedPoolQuizIds.length > 0 && activeTab === 'pool' && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-[90%] max-w-2xl bg-card/90 backdrop-blur-md border border-purple-500/45 rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4 animate-slideUp">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-sm">Đã chọn {selectedPoolQuizIds.length} đợt câu hỏi</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Bạn đã sẵn sàng để tổng hợp câu hỏi và biên soạn bài test lớp học chưa?
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPoolQuizIds([])}
              className="text-xs hover:bg-muted"
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={() => setIsTestDialogOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-md shadow-purple-500/10"
            >
              Tạo bài test <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* CREATE TEST DIALOG */}
      <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-5 w-5 text-purple-400" />
              Tổng hợp bài test lớp học
            </DialogTitle>
            <DialogDescription>
              Hệ thống sẽ nhân bản tất cả câu hỏi trong {selectedPoolQuizIds.length} đợt sinh đã chọn để biên soạn bài test mới.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tên Bài kiểm tra / Đề thi</Label>
              <Input
                placeholder="Ví dụ: Đề kiểm tra 45 phút - Đại Số Lý Thuyết"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                className="bg-muted/30 focus-visible:ring-purple-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Lớp học áp dụng bài test</Label>
              <select
                value={selectedClassIdForTest}
                onChange={(e) => setSelectedClassIdForTest(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-purple-500"
              >
                <option value="">-- Chọn lớp học của bạn --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Thời gian làm bài (Phút)</Label>
                <Input
                  type="number"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(parseInt(e.target.value) || 45)}
                  className="bg-muted/30"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Thang điểm tổng số</Label>
                <Input
                  type="number"
                  value={totalScore}
                  onChange={(e) => setTotalScore(parseInt(e.target.value) || 10)}
                  className="bg-muted/30"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestDialogOpen(false)}>Hủy</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              onClick={handleCreateTest}
              disabled={createTestMutation.isPending}
            >
              {createTestMutation.isPending ? 'Đang tổng hợp...' : 'Tổng hợp & Lưu nháp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}


