import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { poolService } from '@/services/pool.service';
import { documentsService } from '@/services/documents.service';
import { quizzesService } from '@/services/quizzes.service';
import { apiClient } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles, Search, Trash2, BookOpen, Clock, Upload, CheckCircle2,
  ChevronDown, ChevronUp, Loader2, Library, ArrowRight, X,
  Trophy, HelpCircle, Play, RefreshCw, Eye, XCircle, Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { TopicPoolDto, PoolQuizDetailDto, ApiResponse, QuizDto } from '@/types';

type GenerationDifficulty = 'easy' | 'medium' | 'hard';

interface GenerateQuizPayload {
  topicName: string;
  userSuggestion?: string;
  documentId?: string;
  numQuestions: number;
  difficulty: GenerationDifficulty;
}

interface CreateRevisionPayload {
  title: string;
  poolQuizIds: string[];
}

function parseGenerationDifficulty(value: string): GenerationDifficulty {
  if (value === 'easy' || value === 'medium' || value === 'hard') {
    return value;
  }
  return 'medium';
}

export function StudentPoolDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'pool' | 'revision' | 'generate'>('pool');
  
  // Search and selection states
  const [search, setSearch] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<TopicPoolDto | null>(null);
  
  // Collapsed states for previewing quizzes in a topic
  const [expandedQuizzes, setExpandedQuizzes] = useState<Record<string, boolean>>({});
  
  // Question selection state: tracks which pool quiz IDs are selected
  const [selectedPoolQuizIds, setSelectedPoolQuizIds] = useState<string[]>([]);

  // Generate states
  const [topicName, setTopicName] = useState('');
  const [generationType, setGenerationType] = useState<'manual' | 'document'>('manual');
  const [userSuggestion, setUserSuggestion] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<GenerationDifficulty>('medium');
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progressive steps during AI generation
  const [generatingStep, setGeneratingStep] = useState(0);
  const [showGenOverlay, setShowGenOverlay] = useState(false);

  // Create Revision Set Dialog states
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState(false);
  const [revisionTitle, setRevisionTitle] = useState('');

  // Active Quiz Player overlay states
  const [activePlayingQuiz, setActivePlayingQuiz] = useState<PoolQuizDetailDto | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedPlayerOption, setSelectedPlayerOption] = useState<string | null>(null);
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [quizTimer, setQuizTimer] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const timerRef = useRef<any>(null);

  // Queries
  const { data: topics = [], isLoading: isLoadingTopics } = useQuery({
    queryKey: ['student-pool-topics', search],
    queryFn: () => poolService.getTopicsInPool(search),
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['my-documents-student'],
    queryFn: documentsService.getMyDocuments,
  });

  // Query quizzes of selected topic
  const { data: quizzes = [], isLoading: isLoadingQuizzes } = useQuery({
    queryKey: ['quizzes-in-topic-student', selectedTopic?.id],
    queryFn: () => poolService.getQuizzesInTopicPool(selectedTopic!.id),
    enabled: !!selectedTopic,
  });

  // Query student's revision sets (quizzes of type "private" owned by the student)
  // Endpoint: GET /api/pool/revision-sets
  const { data: revisionSets = [], isLoading: isLoadingRevision } = useQuery({
    queryKey: ['student-revision-sets'],
    queryFn: async () => {
      // API call: GET /pool/revision-sets
      const res = await apiClient.get<ApiResponse<QuizDto[]>>('/pool/revision-sets');
      return res.data.data!;
    },
    enabled: activeTab === 'revision',
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
      setSelectedPoolQuizIds(prev => prev.filter(id => !allQuizIds.includes(id)));
    } else {
      setSelectedPoolQuizIds(prev => {
        const unique = new Set([...prev, ...allQuizIds]);
        return Array.from(unique);
      });
    }
  };

  // AI Quiz Generation mutation
  const generateMutation = useMutation({
    mutationFn: (payload: GenerateQuizPayload) => poolService.generatePoolQuiz(payload),
    onSuccess: (quiz) => {
      setShowGenOverlay(false);
      setGeneratingStep(0);
      toast.success(`Đã tạo thành công ${quiz.questionCount} câu ôn tập vào Pool cá nhân!`);
      queryClient.invalidateQueries({ queryKey: ['student-pool-topics'] });
      if (selectedTopic) {
        queryClient.invalidateQueries({ queryKey: ['quizzes-in-topic-student', selectedTopic.id] });
      }
      setTopicName('');
      setUserSuggestion('');
      setSelectedDocId('');
      setActiveTab('pool');
    },
    onError: (err: any) => {
      setShowGenOverlay(false);
      setGeneratingStep(0);
      toast.error('Sinh quiz ôn tập thất bại: ' + (err.response?.data?.message || err.message));
    }
  });

  const handleGenerateQuiz = async () => {
    if (!topicName.trim()) {
      toast.error('Vui lòng nhập tên chủ đề');
      return;
    }
    if (generationType === 'manual' && !userSuggestion.trim()) {
      toast.error('Vui lòng nhập nội dung muốn ôn tập');
      return;
    }
    if (generationType === 'document' && !selectedDocId) {
      toast.error('Vui lòng chọn tài liệu học tập');
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
      userSuggestion: generationType === 'manual' ? userSuggestion.trim() : undefined,
      documentId: generationType === 'document' ? selectedDocId : undefined,
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

      queryClient.invalidateQueries({ queryKey: ['my-documents-student'] });
      setSelectedDocId(documentId);
      toast.success(`Đã tải lên tài liệu ${file.name} thành công!`);
    } catch (err: any) {
      toast.error('Tải tài liệu lên thất bại: ' + err.message);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Create Revision Set mutation
  const createRevisionMutation = useMutation({
    mutationFn: (payload: CreateRevisionPayload) => poolService.createRevisionSetFromPool(payload),
    onSuccess: () => {
      setIsRevisionDialogOpen(false);
      setRevisionTitle('');
      setSelectedPoolQuizIds([]);
      toast.success('Đã tạo Bộ ôn tập cá nhân thành công!');
      queryClient.invalidateQueries({ queryKey: ['student-revision-sets'] });
      setActiveTab('revision');
    },
    onError: (err: any) => {
      toast.error('Tạo bộ ôn tập thất bại: ' + err.message);
    }
  });

  const handleCreateRevision = () => {
    if (!revisionTitle.trim()) {
      toast.error('Vui lòng nhập tên bộ ôn tập');
      return;
    }

    createRevisionMutation.mutate({
      title: revisionTitle.trim(),
      poolQuizIds: selectedPoolQuizIds
    });
  };

  // Delete pool quiz mutation
  const deleteQuizMutation = useMutation({
    mutationFn: (quizId: string) => poolService.deletePoolQuiz(quizId),
    onSuccess: () => {
      toast.success('Đã xóa quiz khỏi Pool cá nhân');
      queryClient.invalidateQueries({ queryKey: ['student-pool-topics'] });
      if (selectedTopic) {
        queryClient.invalidateQueries({ queryKey: ['quizzes-in-topic-student', selectedTopic.id] });
      }
      setSelectedPoolQuizIds(prev => prev.filter(id => !quizzes.some(q => q.quizId === id)));
    },
    onError: (err: any) => {
      toast.error('Xóa thất bại: ' + err.message);
    }
  });

  // Revision set delete mutation
  const deleteRevisionMutation = useMutation({
    mutationFn: (quizId: string) => poolService.deletePoolQuiz(quizId), // private quiz deletion is same API
    onSuccess: () => {
      toast.success('Đã xóa Bộ ôn tập');
      queryClient.invalidateQueries({ queryKey: ['student-revision-sets'] });
    },
    onError: (err: any) => {
      toast.error('Xóa bộ ôn tập thất bại: ' + err.message);
    }
  });

  // QUIZ PLAYER OVERLAY - FLOW IMPLEMENTATION
  const startQuizPlaying = async (quiz: any, isFromRevisionTab = false) => {
    let quizDetails: PoolQuizDetailDto | null = null;
    
    if (isFromRevisionTab) {
      // Revision sets questions need to be loaded from `quizzesService.getMyQuizQuestions`
      try {
        toast.info("Đang chuẩn bị câu hỏi ôn tập...");
        const questions = await quizzesService.getMyQuizQuestions(quiz.id);
        quizDetails = {
          quizId: quiz.id,
          title: quiz.title,
          createdAt: quiz.createdAt,
          questions
        };
      } catch (err: any) {
        toast.error("Không thể tải bộ câu hỏi: " + err.message);
        return;
      }
    } else {
      quizDetails = quiz;
    }

    if (!quizDetails || !quizDetails.questions.length) {
      toast.error("Bộ ôn tập này chưa có câu hỏi nào!");
      return;
    }

    // Initialize player states
    setActivePlayingQuiz(quizDetails);
    setCurrentQuestionIdx(0);
    setSelectedPlayerOption(null);
    setHasSubmittedAnswer(false);
    setCorrectCount(0);
    setQuizTimer(0);
    setIsQuizFinished(false);

    // Start timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setQuizTimer(prev => prev + 1);
    }, 1000);
  };

  const handlePlayerSubmit = () => {
    if (!selectedPlayerOption || !activePlayingQuiz) return;

    const currentQ = activePlayingQuiz.questions[currentQuestionIdx];
    // Find if selected option matches correct answer
    // For our questions, correct answer is either text or key. Let's find correct option in options array
    const selectedOpt = currentQ.options.find(o => o.id === selectedPlayerOption);
    
    const isCorrect = selectedOpt?.isCorrect ?? false;
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    }

    setHasSubmittedAnswer(true);
  };

  const handlePlayerNext = () => {
    if (!activePlayingQuiz) return;
    
    if (currentQuestionIdx < activePlayingQuiz.questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedPlayerOption(null);
      setHasSubmittedAnswer(false);
    } else {
      // Quiz finished
      setIsQuizFinished(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const closeQuizPlayer = () => {
    setActivePlayingQuiz(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTimer = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="relative min-h-[85vh] text-foreground">
      {/* Dynamic Header */}
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
          <Button
            variant={activeTab === 'pool' ? 'default' : 'ghost'}
            className="rounded-lg text-xs md:text-sm font-medium"
            onClick={() => setActiveTab('pool')}
          >
            <Library className="mr-2 h-4 w-4" /> Kho Pool cá nhân
          </Button>
          <Button
            variant={activeTab === 'revision' ? 'default' : 'ghost'}
            className="rounded-lg text-xs md:text-sm font-medium"
            onClick={() => setActiveTab('revision')}
          >
            <Trophy className="mr-2 h-4 w-4" /> Bộ ôn tập của tôi
          </Button>
          <Button
            variant={activeTab === 'generate' ? 'default' : 'ghost'}
            className="rounded-lg text-xs md:text-sm font-medium"
            onClick={() => setActiveTab('generate')}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Tự sinh câu hỏi AI
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
                    className="pl-9 bg-muted/30 focus-visible:ring-indigo-500/50"
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
                    Chưa có chủ đề nào trong pool.
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
                            ? 'bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent border-indigo-500/50 shadow-md shadow-indigo-500/5'
                            : 'border-border/40 hover:bg-muted/40 hover:border-border'
                        )}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-semibold text-sm group-hover:text-indigo-400 transition-colors">
                            {t.name}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-indigo-500/20 text-indigo-300">
                            {t.difficulty === 'easy' ? 'Dễ' : t.difficulty === 'medium' ? 'TB' : 'Khó'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                          {t.description || 'Không có mô tả.'}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/20 pt-1.5">
                          <span>{t.quizCount} đợt sinh</span>
                          <span className="font-medium text-indigo-300/80">{t.questionCount} câu hỏi</span>
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
                        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white">Chủ đề ôn luyện</Badge>
                        <h2 className="text-xl font-bold">{selectedTopic.name}</h2>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tổng cộng {quizzes.length} đợt sinh câu hỏi cá nhân trong Pool.
                      </p>
                    </div>

                    <div className="flex gap-2 self-stretch md:self-auto justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAllInTopic}
                        disabled={!quizzes.length}
                        className="text-xs font-semibold hover:border-indigo-500/40"
                      >
                        {quizzes.length > 0 && quizzes.every(q => selectedPoolQuizIds.includes(q.quizId))
                          ? 'Bỏ chọn tất cả'
                          : 'Chọn tất cả chủ đề'}
                      </Button>
                    </div>
                  </div>

                  {isLoadingQuizzes ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20">
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
                      <p className="text-sm text-muted-foreground">Đang tải câu hỏi...</p>
                    </div>
                  ) : quizzes.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                      <HelpCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
                      <p className="text-lg font-medium">Chưa có câu hỏi ôn tập</p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        Chủ đề này chưa có câu hỏi được tạo. Hãy nhấn nút "Tự sinh câu hỏi AI" ở góc trên bên phải để bắt đầu ôn tập!
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
                                ? "border-indigo-500/40 bg-indigo-500/5 shadow-inner" 
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
                                  className="h-4.5 w-4.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                                />
                                <div className="min-w-0" onClick={() => toggleQuiz(quiz.quizId)}>
                                  <p className="font-semibold text-sm cursor-pointer hover:text-indigo-400 transition-colors truncate">
                                    {quiz.title}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {quiz.questions.length} câu hỏi · {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-xs h-8 hover:bg-indigo-500/10 hover:text-indigo-400"
                                  onClick={() => startQuizPlaying(quiz, false)}
                                >
                                  <Play className="h-3 w-3 mr-1" /> Làm bài
                                </Button>
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
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold shrink-0 mt-0.5">
                                        {idx + 1}
                                      </span>
                                      <p className="text-xs md:text-sm font-medium">{q.text}</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-7">
                                      {q.options.map((opt) => (
                                        <div
                                          key={opt.id}
                                          className={cn(
                                            "rounded-lg px-2.5 py-1.5 text-xs border transition-all shadow-sm",
                                            opt.isCorrect
                                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500 font-semibold ring-1 ring-emerald-500/20"
                                              : "bg-muted/30 text-muted-foreground border-border/60"
                                          )}
                                        >
                                          <span className={cn(
                                            "mr-1.5 font-bold",
                                            opt.isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/60"
                                          )}>{opt.isCorrect ? '✓' : '○'}</span> {opt.text}
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
                  <p className="text-lg font-semibold">Chọn chủ đề cá nhân</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Chọn một chủ đề ở bảng bên trái để xem các đợt câu hỏi tự luyện của bạn.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      ) : activeTab === 'revision' ? (
        /* REVISION SETS TAB - LIST SAVED KITS */
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-border/50 pb-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-indigo-400" />
              Danh sách Bộ ôn tập cá nhân
            </h2>
            <p className="text-xs text-muted-foreground">
              Tổng hợp từ các câu hỏi trong Pool để luyện thi tập trung.
            </p>
          </div>

          {isLoadingRevision ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl bg-muted/50 border border-border/40" />
              ))}
            </div>
          ) : revisionSets.length === 0 ? (
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm p-12 text-center max-w-lg mx-auto">
              <Library className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-lg font-semibold">Chưa lập bộ ôn tập nào</p>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Bạn có thể chọn (tick) các đợt sinh câu hỏi trong tab "Kho Pool cá nhân", sau đó nhấn "Lập bộ ôn tập" ở Action Bar phía dưới!
              </p>
              <Button onClick={() => setActiveTab('pool')} className="bg-indigo-600 hover:bg-indigo-700">
                Tới kho Pool cá nhân
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {revisionSets.map((kit) => (
                <Card key={kit.id} className="border-border bg-card/60 backdrop-blur-sm hover:border-indigo-500/40 transition-all duration-300 shadow-lg flex flex-col justify-between">
                  <CardContent className="p-4 space-y-3.5">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-base text-foreground line-clamp-1">
                        {kit.title}
                      </span>
                      <Badge className="bg-indigo-600/10 text-indigo-300 border-indigo-500/20 text-[10px]">
                        {kit.questionCount} câu hỏi
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Ngày tạo: {new Date(kit.createdAt).toLocaleDateString('vi-VN')}
                    </p>

                    <Separator className="bg-border/20" />

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => deleteRevisionMutation.mutate(kit.id)}
                        disabled={deleteRevisionMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Link to={`/student/ai-lab/${kit.id}`} className="block">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs hover:border-indigo-500/40"
                        >
                          <Eye className="h-3 w-3 mr-1" /> Sửa/Xem câu
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold"
                        onClick={() => startQuizPlaying(kit, true)}
                      >
                        <Play className="h-3 w-3 mr-1" /> Ôn luyện
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* GENERATE TAB - AI CREATOR */
        <Card className="border-border bg-card/60 backdrop-blur-sm shadow-xl max-w-2xl mx-auto">
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-border/50 pb-3">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <h2 className="text-xl font-bold">Sinh câu hỏi ôn tập thông minh bằng AI</h2>
            </div>

            {/* Topic Input */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">1. Tên Chủ đề tự đặt</Label>
              <Input
                placeholder="Ví dụ: Công thức Toán đại số, Bất đẳng thức Cauchy, Từ vựng TOEIC..."
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                className="bg-muted/30 focus-visible:ring-indigo-500"
              />
              <p className="text-[10px] text-muted-foreground italic">
                * Lưu ý: Nhập trùng tên chủ đề đã có để câu hỏi mới tự động **CỘNG DỒN** vào chủ đề đó!
              </p>
            </div>

            {/* Generator Type Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">2. Phương thức tạo câu hỏi</Label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setGenerationType('manual')}
                  className={cn(
                    "cursor-pointer rounded-xl p-3 border text-center transition-all duration-300",
                    generationType === 'manual'
                      ? "border-indigo-500/50 bg-indigo-500/5 font-semibold text-indigo-300"
                      : "border-border/40 hover:bg-muted/40"
                  )}
                >
                  Nhập nội dung muốn ôn
                </div>
                <div
                  onClick={() => setGenerationType('document')}
                  className={cn(
                    "cursor-pointer rounded-xl p-3 border text-center transition-all duration-300",
                    generationType === 'document'
                      ? "border-indigo-500/50 bg-indigo-500/5 font-semibold text-indigo-300"
                      : "border-border/40 hover:bg-muted/40"
                  )}
                >
                  Upload tài liệu / giáo trình
                </div>
              </div>
            </div>

            {generationType === 'manual' ? (
              <div className="space-y-2 animate-fadeIn">
                <Label className="text-sm font-semibold">Nhập mô tả những gì bạn muốn ôn tập</Label>
                <Textarea
                  placeholder="Ví dụ: Tạo 10 câu hỏi trắc nghiệm về phương trình bậc 2 và bất phương trình kèm giải thích dễ hiểu..."
                  value={userSuggestion}
                  onChange={(e) => setUserSuggestion(e.target.value)}
                  rows={4}
                  className="bg-muted/30 focus-visible:ring-indigo-500"
                />
              </div>
            ) : (
              <div className="space-y-3 animate-fadeIn">
                <Label className="text-sm font-semibold">Chọn giáo trình / ghi chú đã upload hoặc tải file mới</Label>
                <div className="flex gap-2">
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="flex-1 flex h-10 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-indigo-500"
                  >
                    <option value="">-- Chọn tài liệu riêng --</option>
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
                    Upload file mới
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  * Hỗ trợ file PDF, TXT, DOCX. AI gia sư sẽ soạn câu hỏi trắc nghiệm dựa trên nội dung bạn gửi.
                </p>
              </div>
            )}

            {/* Difficulty & Number of Questions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Mức độ ôn tập</Label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(parseGenerationDifficulty(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background focus-visible:ring-indigo-500"
                >
                  <option value="easy">Cơ bản (Củng cố nền tảng)</option>
                  <option value="medium">Khá (Tăng tốc học tập)</option>
                  <option value="hard">Nâng cao (Phục vụ ôn thi học sinh giỏi)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Số câu cần tạo</Label>
                <select
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background focus-visible:ring-indigo-500"
                >
                  <option value={3}>Tạo 3 câu hỏi</option>
                  <option value={5}>Tạo 5 câu hỏi</option>
                  <option value={10}>Tạo 10 câu hỏi</option>
                  <option value={15}>Tạo 15 câu hỏi</option>
                </select>
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-blue-500 via-indigo-600 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white font-semibold py-6 rounded-xl shadow-lg shadow-indigo-500/20"
              onClick={handleGenerateQuiz}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Gia sư AI đang chuẩn bị câu hỏi...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Sinh Quiz ôn tập với AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* FLOATING ACTION BOTTOM PANEL - CREATE REVISION SET BAR */}
      {selectedPoolQuizIds.length > 0 && activeTab === 'pool' && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-[90%] max-w-2xl bg-card/90 backdrop-blur-md border border-indigo-500/45 rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4 animate-slideUp">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-sm">Đã chọn {selectedPoolQuizIds.length} đợt câu hỏi</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Lập Bộ ôn tập để luyện thi tập trung cho kì thi sắp tới!
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
              onClick={() => setIsRevisionDialogOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/10"
            >
              Lập bộ ôn tập <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* CREATE REVISION SET DIALOG */}
      <Dialog open={isRevisionDialogOpen} onOpenChange={setIsRevisionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-indigo-400" />
              Tạo bộ ôn tập tập trung
            </DialogTitle>
            <DialogDescription>
              Hệ thống sẽ tổng hợp câu hỏi từ {selectedPoolQuizIds.length} đợt sinh đã chọn tạo thành một Bộ ôn tập riêng tư.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tên Bộ ôn tập</Label>
              <Input
                placeholder="Ví dụ: Ôn thi cuối kỳ môn Toán, Tổng ôn Sử chương 3..."
                value={revisionTitle}
                onChange={(e) => setRevisionTitle(e.target.value)}
                className="bg-muted/30 focus-visible:ring-indigo-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRevisionDialogOpen(false)}>Hủy</Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              onClick={handleCreateRevision}
              disabled={createRevisionMutation.isPending}
            >
              {createRevisionMutation.isPending ? 'Đang tạo...' : 'Tạo bộ ôn tập'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI PROGRESS PROGRESSIVE LOADING OVERLAY */}
      {showGenOverlay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-fadeIn p-4">
          <Card className="max-w-md w-full border-indigo-500/30 bg-card/90 shadow-2xl p-6 text-center space-y-6">
            <div className="relative mx-auto h-20 w-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <Sparkles className="h-8 w-8 text-indigo-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold">Gia sư AI đang soạn câu hỏi</h3>
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
                      isCompleted ? "bg-green-500 text-black" : isActive ? "bg-indigo-500 text-white animate-pulse" : "bg-muted text-muted-foreground"
                    )}>
                      {isCompleted ? '✓' : idx + 1}
                    </div>
                    <span className={cn(
                      "text-xs",
                      isActive ? "text-indigo-300 font-semibold" : isCompleted ? "text-green-400" : "text-muted-foreground/60"
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

      {/* IN-DASHBOARD HIGH-FIDELITY QUIZ PLAYER OVERLAY */}
      {activePlayingQuiz && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center animate-fadeIn p-4 overflow-y-auto">
          <Card className="max-w-2xl w-full border-indigo-500/30 bg-card/90 shadow-2xl relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={closeQuizPlayer}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground h-8 w-8 rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>

            {!isQuizFinished ? (
              <CardContent className="p-6 space-y-6">
                {/* Timer and Progress bar */}
                <div className="flex items-center justify-between border-b border-border/40 pb-3 gap-3">
                  <div>
                    <h3 className="font-bold text-base text-foreground line-clamp-1">{activePlayingQuiz.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Luyện tập cá nhân</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
                    <Clock className="h-4 w-4" />
                    <span>{formatTimer(quizTimer)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Tiến trình câu hỏi</span>
                    <span>{currentQuestionIdx + 1} / {activePlayingQuiz.questions.length}</span>
                  </div>
                  <Progress value={((currentQuestionIdx + 1) / activePlayingQuiz.questions.length) * 100} className="h-1.5 bg-muted/40" />
                </div>

                {/* Question */}
                {(() => {
                  const q = activePlayingQuiz.questions[currentQuestionIdx];
                  if (!q) return null;

                  return (
                    <div className="space-y-4">
                      <div className="flex items-start gap-2">
                        <Badge className="bg-indigo-600 text-white select-none">Câu {currentQuestionIdx + 1}</Badge>
                        <h4 className="text-base font-semibold leading-relaxed text-foreground">{q.text}</h4>
                      </div>

                      <div className="space-y-2.5">
                        {q.options.map((opt) => {
                          const isSelected = selectedPlayerOption === opt.id;
                          const showSuccess = hasSubmittedAnswer && opt.isCorrect;
                          const showDanger = hasSubmittedAnswer && isSelected && !opt.isCorrect;

                          return (
                            <button
                              key={opt.id}
                              disabled={hasSubmittedAnswer}
                              onClick={() => setSelectedPlayerOption(opt.id)}
                              className={cn(
                                "w-full rounded-xl border p-3.5 text-left transition-all duration-200 flex items-center justify-between gap-3 text-xs md:text-sm font-medium",
                                showSuccess 
                                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300" 
                                  : showDanger
                                    ? "border-red-500/50 bg-red-500/10 text-red-400 line-through"
                                    : isSelected
                                      ? "border-indigo-500 bg-indigo-500/10 text-foreground"
                                      : "border-border/40 hover:border-border hover:bg-muted/20 text-muted-foreground hover:text-foreground"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                {(() => {
                                  const badgeClass = showSuccess
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : showDanger
                                    ? "border-red-500 bg-red-500 text-black"
                                    : isSelected
                                    ? "border-indigo-500 bg-indigo-500 text-primary-foreground"
                                    : "border-border text-muted-foreground";
                                  return (
                                <span className={cn(
                                  "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold transition-all",
                                  badgeClass
                                )}>
                                  {opt.text.startsWith('A') || opt.text.startsWith('B') || opt.text.startsWith('C') || opt.text.startsWith('D') 
                                    ? opt.text[0] 
                                    : '○'}
                                 </span>
                                  );
                                })()}
                                <span>{opt.text}</span>
                              </div>
                              {showSuccess && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                              {showDanger && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation box */}
                      {hasSubmittedAnswer && q.explanation && (
                        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3.5 animate-fadeIn">
                          <div className="flex items-center gap-2 text-amber-400 font-semibold mb-1 text-xs md:text-sm">
                            <Lightbulb className="h-4 w-4" />
                            <span>Gia sư AI giải thích</span>
                          </div>
                          <p className="text-xs md:text-sm text-foreground/80 leading-relaxed">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Footer buttons */}
                <div className="flex justify-end border-t border-border/30 pt-4 mt-2">
                  {!hasSubmittedAnswer ? (
                    <Button
                      onClick={handlePlayerSubmit}
                      disabled={!selectedPlayerOption}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 rounded-lg"
                    >
                      Nộp câu trả lời
                    </Button>
                  ) : (
                    <Button
                      onClick={handlePlayerNext}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 rounded-lg"
                    >
                      {currentQuestionIdx < activePlayingQuiz.questions.length - 1 ? 'Tiếp tục' : 'Hoàn thành ôn luyện'}
                    </Button>
                  )}
                </div>
              </CardContent>
            ) : (
              /* QUIZ FINISHED RESULTS SCREEN */
              <CardContent className="p-6 text-center space-y-6">
                <div className="relative mx-auto h-24 w-24 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/25 to-violet-500/25 blur-xl animate-pulse" />
                  <div className="absolute inset-2 rounded-full bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20" />
                  <Trophy className="relative h-12 w-12 text-indigo-400 drop-shadow-lg" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                    Hoàn thành đợt ôn luyện!
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Chúc mừng bạn đã kết thúc quá trình làm bài luyện tập. Hãy xem lại kết quả phân tích năng lực dưới đây.
                  </p>
                </div>

                <div className="max-w-xs mx-auto rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center border-b border-border/20 pb-3">
                    <div>
                      <p className="text-xl font-extrabold">{activePlayingQuiz.questions.length}</p>
                      <p className="text-[10px] text-muted-foreground">Tổng số câu</p>
                    </div>
                    <div>
                      <p className="text-xl font-extrabold text-green-400">{correctCount}</p>
                      <p className="text-[10px] text-muted-foreground">Chính xác</p>
                    </div>
                    <div>
                      <p className="text-xl font-extrabold text-indigo-300">
                        {Math.round((correctCount / activePlayingQuiz.questions.length) * 100)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">Tỷ lệ đúng</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
                    <span>Thời gian làm bài:</span>
                    <span className="font-semibold text-indigo-400">{formatTimer(quizTimer)}</span>
                  </div>
                </div>

                <div className="flex justify-center gap-3 border-t border-border/30 pt-5">
                  <Button variant="outline" onClick={() => startQuizPlaying(activePlayingQuiz, false)}>
                    <RefreshCw className="h-4 w-4 mr-1.5" /> Luyện tập lại
                  </Button>
                  <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={closeQuizPlayer}>
                    Quay lại Dashboard
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
