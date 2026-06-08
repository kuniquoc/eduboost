import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { poolService } from '@/services/pool.service';
import { classesService } from '@/services/classes.service';
import { documentsService } from '@/services/documents.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles, Search, Trash2, BookOpen, Upload, CheckCircle2,
  ChevronDown, ChevronUp, Loader2, Library, ArrowRight, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { TopicPoolDto } from '@/types';

export function TeacherPoolDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pool' | 'generate'>('pool');
  
  // Search and selection states
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<TopicPoolDto | null>(null);
  
  // Question selection state: tracks which pool quiz IDs are selected
  const [selectedPoolQuizIds, setSelectedPoolQuizIds] = useState<string[]>([]);
  
  // Collapsed states for previewing quizzes in a topic
  const [expandedQuizzes, setExpandedQuizzes] = useState<Record<string, boolean>>({});

  // Generate states
  const [topicName, setTopicName] = useState('');
  const [generationType, setGenerationType] = useState<'manual' | 'document'>('manual');
  const [userSuggestion, setUserSuggestion] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedClassIdForTopic, setSelectedClassIdForTopic] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progressive steps during AI generation
  const [generatingStep, setGeneratingStep] = useState(0);
  const [showGenOverlay, setShowGenOverlay] = useState(false);

  // Create Test Dialog states
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [testTitle, setTestTitle] = useState('');
  const [selectedClassIdForTest, setSelectedClassIdForTest] = useState('');
  const [timeLimit, setTimeLimit] = useState(45);
  const [totalScore, setTotalScore] = useState(10);

  // Queries
  const { data: topics = [], isLoading: isLoadingTopics } = useQuery({
    queryKey: ['teacher-pool-topics', search],
    queryFn: () => poolService.getTopicsInPool(search),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: classesService.getTeacherClasses,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['my-documents-teacher'],
    queryFn: documentsService.getMyDocuments, // Fetches private doc pool
  });

  // Query quizzes of selected topic
  const { data: quizzes = [], isLoading: isLoadingQuizzes } = useQuery({
    queryKey: ['quizzes-in-topic', selectedTopic?.id],
    queryFn: () => poolService.getQuizzesInTopicPool(selectedTopic!.id),
    enabled: !!selectedTopic,
  });

  // Select topic initially
  useEffect(() => {
    if (topics.length > 0 && !selectedTopic) {
      setSelectedTopic(topics[0]);
    }
  }, [topics, selectedTopic]);

  // Collapsible toggle helper
  const toggleQuiz = (quizId: string) => {
    setExpandedQuizzes(prev => ({ ...prev, [quizId]: !prev[quizId] }));
  };

  // Checkbox select helpers
  const handleSelectQuiz = (quizId: string) => {
    setSelectedPoolQuizIds(prev => 
      prev.includes(quizId) ? prev.filter(id => id !== quizId) : [...prev, quizId]
    );
  };

  const handleSelectAllInTopic = () => {
    if (!quizzes.length) return;
    const allQuizIds = quizzes.map(q => q.quizId);
    const allSelected = allQuizIds.every(id => selectedPoolQuizIds.includes(id));
    
    if (allSelected) {
      // Remove all quizzes of this topic from selection
      setSelectedPoolQuizIds(prev => prev.filter(id => !allQuizIds.includes(id)));
    } else {
      // Add all missing quizzes of this topic to selection
      setSelectedPoolQuizIds(prev => {
        const unique = new Set([...prev, ...allQuizIds]);
        return Array.from(unique);
      });
    }
  };

  // AI Quiz Generation mutation
  const generateMutation = useMutation({
    mutationFn: (payload: any) => poolService.generatePoolQuiz(payload),
    onSuccess: (quiz) => {
      setShowGenOverlay(false);
      setGeneratingStep(0);
      toast.success(`Đã tạo thành công ${quiz.questionCount} câu hỏi vào Quiz Pool!`);
      queryClient.invalidateQueries({ queryKey: ['teacher-pool-topics'] });
      if (selectedTopic) {
        queryClient.invalidateQueries({ queryKey: ['quizzes-in-topic', selectedTopic.id] });
      }
      // Reset form
      setTopicName('');
      setUserSuggestion('');
      setSelectedDocId('');
      setActiveTab('pool');
    },
    onError: (err: any) => {
      setShowGenOverlay(false);
      setGeneratingStep(0);
      toast.error('Sinh quiz thất bại: ' + (err.response?.data?.message || err.message));
    }
  });

  const handleGenerateQuiz = async () => {
    if (!topicName.trim()) {
      toast.error('Vui lòng nhập tên chủ đề');
      return;
    }
    if (generationType === 'manual' && !userSuggestion.trim()) {
      toast.error('Vui lòng nhập mô tả gợi ý nội dung');
      return;
    }
    if (generationType === 'document' && !selectedDocId) {
      toast.error('Vui lòng chọn tài liệu để sinh quiz');
      return;
    }

    // Trigger AI progressive steps overlay
    setShowGenOverlay(true);
    setGeneratingStep(1);
    
    const interval = setInterval(() => {
      setGeneratingStep(prev => {
        if (prev < 3) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 4500);

    generateMutation.mutate({
      topicName: topicName.trim(),
      classId: selectedClassIdForTopic || null,
      userSuggestion: generationType === 'manual' ? userSuggestion.trim() : null,
      documentId: generationType === 'document' ? selectedDocId : null,
      numQuestions,
      difficulty
    });
  };

  // Presigned document upload helper
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const { uploadUrl, documentId } = await documentsService.requestStudentUploadUrl({
        fileName: file.name,
        fileSize: file.size.toString()
      });

      await documentsService.uploadFileToMinio(uploadUrl, file);
      await documentsService.confirmStudentUpload(documentId);

      queryClient.invalidateQueries({ queryKey: ['my-documents-teacher'] });
      setSelectedDocId(documentId);
      toast.success(`Đã tải lên tài liệu ${file.name} thành công!`);
    } catch (err: any) {
      toast.error('Tải tài liệu lên thất bại: ' + err.message);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete quiz mutation
  const deleteQuizMutation = useMutation({
    mutationFn: (quizId: string) => poolService.deletePoolQuiz(quizId),
    onSuccess: () => {
      toast.success('Đã xóa quiz khỏi Pool');
      queryClient.invalidateQueries({ queryKey: ['teacher-pool-topics'] });
      if (selectedTopic) {
        queryClient.invalidateQueries({ queryKey: ['quizzes-in-topic', selectedTopic.id] });
      }
      setSelectedPoolQuizIds(prev => prev.filter(id => !quizzes.some(q => q.quizId === id)));
    },
    onError: (err: any) => {
      toast.error('Xóa thất bại: ' + err.message);
    }
  });

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
          <p className="mt-1 text-sm text-muted-foreground">
            Kho lưu trữ câu hỏi AI thông minh, cộng dồn vô hạn. Tạo bài kiểm tra lớp học trong 3 bước.
          </p>
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT PANEL - TOPIC LIST */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-border bg-card/60 backdrop-blur-sm shadow-xl">
              <CardContent className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Tìm theo chủ đề..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-muted/30 focus-visible:ring-purple-500/50"
                  />
                </div>

                <Separator className="bg-border/60" />

                {isLoadingTopics ? (
                  <div className="space-y-2 py-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/50" />
                    ))}
                  </div>
                ) : topics.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <BookOpen className="mx-auto h-8 w-8 mb-2 opacity-50" />
                    Chưa tìm thấy chủ đề nào trong pool.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
                    {topics.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTopic(t)}
                        className={cn(
                          'group cursor-pointer rounded-xl p-3 border transition-all duration-300',
                          selectedTopic?.id === t.id
                            ? 'bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border-purple-500/50 shadow-md shadow-purple-500/5'
                            : 'border-border/40 hover:bg-muted/40 hover:border-border'
                        )}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-semibold text-sm group-hover:text-purple-400 transition-colors">
                            {t.name}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-purple-500/20 text-purple-300">
                            {t.difficulty === 'easy' ? 'Dễ' : t.difficulty === 'medium' ? 'TB' : 'Khó'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                          {t.description || 'Không có mô tả.'}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/20 pt-1.5">
                          <span>{t.quizCount} đợt sinh</span>
                          <span className="font-medium text-purple-300/80">{t.questionCount} câu hỏi</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL - DETAILED POOL QUIZZES PREVIEW */}
          <div className="lg:col-span-8 space-y-4">
            {selectedTopic ? (
              <Card className="border-border bg-card/60 backdrop-blur-sm shadow-xl min-h-[62vh] flex flex-col">
                <CardContent className="p-5 flex-1 flex flex-col">
                  {/* Topic Header & Selector actions */}
                  <div className="flex flex-col gap-3 justify-between items-start md:flex-row md:items-center border-b border-border/50 pb-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-600 hover:bg-purple-700 text-white">Chủ đề</Badge>
                        <h2 className="text-xl font-bold">{selectedTopic.name}</h2>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tổng cộng {quizzes.length} đợt sinh và {selectedTopic.questionCount} câu hỏi lưu trữ.
                      </p>
                    </div>

                    <div className="flex gap-2 self-stretch md:self-auto justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllInTopic}
                        disabled={!quizzes.length}
                        className="text-xs font-semibold hover:border-purple-500/40"
                      >
                        {quizzes.length > 0 && quizzes.every(q => selectedPoolQuizIds.includes(q.quizId))
                          ? 'Bỏ chọn tất cả'
                          : 'Chọn tất cả chủ đề'}
                      </Button>
                    </div>
                  </div>

                  {isLoadingQuizzes ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-3" />
                      <p className="text-sm text-muted-foreground">Đang tải preview câu hỏi...</p>
                    </div>
                  ) : quizzes.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                      <HelpCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
                      <p className="text-lg font-medium">Chưa có câu hỏi nào</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Chủ đề này chưa có câu hỏi được tạo. Hãy nhấn nút "Sinh Quiz AI mới" ở góc trên bên phải để bắt đầu!
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-3 overflow-y-auto max-h-[50vh] pr-1">
                      {quizzes.map((quiz) => {
                        const isExpanded = expandedQuizzes[quiz.quizId] ?? false;
                        const isSelected = selectedPoolQuizIds.includes(quiz.quizId);
                        
                        return (
                          <div 
                            key={quiz.quizId} 
                            className={cn(
                              "border rounded-xl transition-all duration-300 overflow-hidden",
                              isSelected 
                                ? "border-purple-500/40 bg-purple-500/5 shadow-inner" 
                                : "border-border/40 bg-muted/10 hover:border-border/80"
                            )}
                          >
                            {/* Quiz Accordion Header */}
                            <div className="flex items-center justify-between p-3 gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSelectQuiz(quiz.quizId)}
                                  className="h-4.5 w-4.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                                />
                                <div className="min-w-0" onClick={() => toggleQuiz(quiz.quizId)}>
                                  <p className="font-semibold text-sm cursor-pointer hover:text-purple-400 transition-colors truncate">
                                    {quiz.title}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {quiz.questions.length} câu hỏi · {new Date(quiz.createdAt).toLocaleDateString('vi-VN')} lúc {new Date(quiz.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteQuizMutation.mutate(quiz.quizId)}
                                  disabled={deleteQuizMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 hover:bg-muted"
                                  onClick={() => toggleQuiz(quiz.quizId)}
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>

                            {/* Collapsible Preview Question Body */}
                            {isExpanded && (
                              <div className="border-t border-border/30 bg-card/40 p-4 space-y-4">
                                {quiz.questions.map((q, idx) => (
                                  <div key={q.id} className="space-y-2 border-b border-border/20 last:border-0 pb-3 last:pb-0">
                                    <div className="flex items-start gap-2">
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold shrink-0 mt-0.5">
                                        {idx + 1}
                                      </span>
                                      <p className="text-xs md:text-sm font-medium">{q.text}</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-7">
                                      {q.options.map((opt) => (
                                        <div
                                          key={opt.id}
                                          className={cn(
                                            "rounded-lg px-2.5 py-1.5 text-xs border",
                                            opt.isCorrect
                                              ? "bg-green-500/10 text-green-400 border-green-500/30 font-semibold"
                                              : "bg-muted/10 text-muted-foreground border-transparent"
                                          )}
                                        >
                                          <span className="mr-1">{opt.isCorrect ? '✓' : '○'}</span> {opt.text}
                                        </div>
                                      ))}
                                    </div>
                                    {q.explanation && (
                                      <p className="text-[11px] text-muted-foreground italic ml-7 mt-1.5">
                                        💡 {q.explanation}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border bg-card/60 backdrop-blur-sm shadow-xl h-[62vh] flex items-center justify-center">
                <div className="text-center p-8">
                  <Library className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-lg font-semibold">Chọn chủ đề để xem</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Chọn một chủ đề ở bảng bên trái để xem các đợt sinh câu hỏi AI và preview nội dung.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* GENERATE TAB - AI CREATOR */
        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-xl max-w-2xl mx-auto">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-border/50 pb-3">
              <Sparkles className="h-5 w-5 text-purple-400" />
              <h2 className="text-xl font-bold">Sinh câu hỏi thông minh bằng AI</h2>
            </div>

            {/* Topic Input */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">1. Tên Chủ đề chính</Label>
              <Input
                placeholder="Ví dụ: Lịch sử Việt Nam thế kỷ 20, Phương trình lượng giác..."
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                className="bg-muted/30 focus-visible:ring-purple-500"
              />
              <p className="text-[10px] text-muted-foreground italic">
                * Mẹo: Nhập trùng tên chủ đề cũ để **CỘNG DỒN** câu hỏi mới vào kho lưu trữ mà không lo bị ghi đè!
              </p>
            </div>

            {/* Class association (Optional) */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Gắn chủ đề vào lớp học (Tùy chọn)</Label>
              <select
                value={selectedClassIdForTopic}
                onChange={(e) => setSelectedClassIdForTopic(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">-- Lưu làm chủ đề cá nhân (Chỉ mình bạn thấy) --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Generator Type Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">2. Phương thức tạo quiz</Label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setGenerationType('manual')}
                  className={cn(
                    "cursor-pointer rounded-xl p-3 border text-center transition-all duration-300",
                    generationType === 'manual'
                      ? "border-purple-500/50 bg-purple-500/5 font-semibold text-purple-300"
                      : "border-border/40 hover:bg-muted/40"
                  )}
                >
                  Tự nhập gợi ý yêu cầu
                </div>
                <div
                  onClick={() => setGenerationType('document')}
                  className={cn(
                    "cursor-pointer rounded-xl p-3 border text-center transition-all duration-300",
                    generationType === 'document'
                      ? "border-purple-500/50 bg-purple-500/5 font-semibold text-purple-300"
                      : "border-border/40 hover:bg-muted/40"
                  )}
                >
                  Upload tài liệu học tập
                </div>
              </div>
            </div>

            {generationType === 'manual' ? (
              <div className="space-y-2 animate-fadeIn">
                <Label className="text-sm font-semibold">Nhập gợi ý/mô tả cụ thể câu hỏi cần sinh</Label>
                <Textarea
                  placeholder="Ví dụ: Tạo 5 câu hỏi về Chiến dịch Điện Biên Phủ, dạng trắc nghiệm 4 đáp án từ dễ tới khó..."
                  value={userSuggestion}
                  onChange={(e) => setUserSuggestion(e.target.value)}
                  rows={4}
                  className="bg-muted/30 focus-visible:ring-purple-500"
                />
              </div>
            ) : (
              <div className="space-y-3 animate-fadeIn">
                <Label className="text-sm font-semibold">Chọn tài liệu có sẵn hoặc tải file mới</Label>
                <div className="flex gap-2">
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="flex-1 flex h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">-- Chọn tài liệu ôn tập --</option>
                    {documents.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.name}</option>
                    ))}
                  </select>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt,.md"
                    onChange={handleUploadFile}
                  />
                  <Button 
                    variant="outline" 
                    type="button"
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={uploadingFile}
                  >
                    {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Tải lên file mới
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  * Hỗ trợ định dạng PDF, TXT, DOCX. AI sẽ đọc tài liệu để sinh câu hỏi trắc nghiệm bám sát nội dung.
                </p>
              </div>
            )}

            {/* Difficulty & Number of Questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Độ khó mục tiêu</Label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-ring"
                >
                  <option value="easy">Dễ (Kiến thức cơ bản)</option>
                  <option value="medium">Trung bình (Thông hiểu - Vận dụng)</option>
                  <option value="hard">Khó (Vận dụng cao - Phân hóa)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Số câu hỏi cần tạo</Label>
                <select
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-ring"
                >
                  <option value={3}>Tạo 3 câu hỏi</option>
                  <option value={5}>Tạo 5 câu hỏi</option>
                  <option value={10}>Tạo 10 câu hỏi</option>
                  <option value={15}>Tạo 15 câu hỏi</option>
                </select>
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-semibold py-6 rounded-xl shadow-lg shadow-purple-500/20"
              onClick={handleGenerateQuiz}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Đang phân tích và sinh câu hỏi...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Sinh Quiz với AI
                </>
              )}
            </Button>
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

      {/* AI PROGRESS PROGRESSIVE LOADING OVERLAY */}
      {showGenOverlay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-fadeIn p-4">
          <Card className="max-w-md w-full border-purple-500/30 bg-card/90 shadow-2xl p-6 text-center space-y-6">
            <div className="relative mx-auto h-20 w-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
              <Sparkles className="h-8 w-8 text-purple-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold">Trí tuệ nhân tạo đang sinh câu hỏi</h3>
              <p className="text-xs text-muted-foreground">
                Quá trình phân tích tài liệu và cấu trúc câu hỏi có thể mất khoảng 20-40 giây.
              </p>
            </div>

            {/* Progressive Steps indicator */}
            <div className="space-y-3.5 max-w-xs mx-auto text-left">
              {[
                'Đọc tài liệu và hiểu ngữ cảnh...',
                'Phân tích cây kiến thức & tìm lỗ hổng...',
                'Soạn thảo câu hỏi trắc nghiệm & giải thích...',
                'Đang chuẩn hóa định dạng Quiz Pool...'
              ].map((step, idx) => {
                const isActive = generatingStep === idx;
                const isCompleted = generatingStep > idx;

                return (
                  <div key={idx} className="flex items-center gap-3 transition-opacity duration-300">
                    <div className={cn(
                      "h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                      isCompleted ? "bg-green-500 text-black" : isActive ? "bg-purple-500 text-white animate-pulse" : "bg-muted text-muted-foreground"
                    )}>
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <span className={cn(
                      "text-xs",
                      isActive ? "text-purple-300 font-semibold" : isCompleted ? "text-green-400" : "text-muted-foreground/60"
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
    </div>
  );
}


