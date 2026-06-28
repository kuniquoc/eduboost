import { useState, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { poolService } from '@/features/quiz-pool/api/pool.service';
import { documentsService } from '@/features/documents/api/documents.service';
import { quizzesService } from '@/features/quizzes/api/quizzes.service';
import { usePoolTopics } from '@/features/quiz-pool/hooks/use-pool-topics';
import { useMyDocuments } from '@/features/documents/hooks/use-my-documents';
import { useQuizzesInTopic } from '@/features/quiz-pool/hooks/use-quizzes-in-topic';
import { useRevisionSets } from '@/features/quiz-pool/hooks/use-revision-sets';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { Badge } from '@/shared/ui/badge';
import { Separator } from '@/shared/ui/separator';
import {
  Sparkles, Search, Trash2, BookOpen, Upload,
  ChevronDown, ChevronUp, Loader2, Library,
  Trophy, HelpCircle, Play, Eye, Pencil, Check, X
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { getErrorMessage } from '@/shared/lib/error-message';
import type { TopicPoolDto, PoolQuizDetailDto } from '@/features/quiz-pool/types';
import {
  GenerationProgressOverlay,
  PoolDashboardHeader,
  RevisionSelectionBar,
  RevisionSetDialog,
  type StudentPoolTab,
} from '@/features/quiz-pool/components/student-pool-dashboard-components';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/shared/ui/dialog';

type GenerationDifficulty = 'easy' | 'medium' | 'hard';

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<StudentPoolTab>('pool');
  
  // Search and selection states
  const [search, setSearch] = useState('');
  const [selectedTopicState, setSelectedTopic] = useState<TopicPoolDto | null>(null);
  
  // Collapsed states for previewing quizzes in a topic
  const [expandedQuizzes, setExpandedQuizzes] = useState<Record<string, boolean>>({});
  
  // Question selection state: tracks which pool quiz IDs are selected
  const [selectedPoolQuizIds, setSelectedPoolQuizIds] = useState<string[]>([]);

  // Generate states
  const [topicName, setTopicName] = useState('');
  const [userSuggestion, setUserSuggestion] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState<GenerationDifficulty>('medium');
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [easyCount, setEasyCount] = useState(0);
  const [mediumCount, setMediumCount] = useState(5);
  const [hardCount, setHardCount] = useState(0);
  const [genMode, setGenMode] = useState<'append' | 'replace'>('append');
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydratedTabParamRef = useRef<string | null>(null);
  const hydratedDocumentParamRef = useRef<string | null>(null);

  // Inline topic rename states
  const [renamingTopicId, setRenamingTopicId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Progressive steps during AI generation
  const [generatingStep, setGeneratingStep] = useState(0);
  const [showGenOverlay, setShowGenOverlay] = useState(false);

  // Create Revision Set Dialog states
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState(false);
  const [revisionTitle, setRevisionTitle] = useState('');

  // Delete confirm states
  const [deleteQuizId, setDeleteQuizId] = useState<string | null>(null);
  const [deleteRevisionId, setDeleteRevisionId] = useState<string | null>(null);

  // Queries
  const { data: topics = [], isLoading: isLoadingTopics } = usePoolTopics(search);
  const selectedTopic = selectedTopicState && topics.some((topic) => topic.id === selectedTopicState.id)
    ? selectedTopicState
    : topics[0] ?? null;
  const { data: documents = [] } = useMyDocuments();
  const { data: quizzes = [], isLoading: isLoadingQuizzes } = useQuizzesInTopic(selectedTopic?.id);
  const { data: revisionSets = [], isLoading: isLoadingRevision } = useRevisionSets(activeTab === 'revision');
  const tabParam = searchParams.get('tab');
  const documentIdParam = searchParams.get('documentId');

  useEffect(() => {
    if (tabParam === 'generate') {
      if (hydratedTabParamRef.current !== tabParam) {
        // URL là nguồn bên ngoài; cập nhật ở microtask để tránh render nối tiếp trong effect.
        queueMicrotask(() => {
          setActiveTab('generate');
          hydratedTabParamRef.current = tabParam;
        });
      }
      return;
    }
    hydratedTabParamRef.current = null;
  }, [tabParam]);

  useEffect(() => {
    if (!documentIdParam) {
      hydratedDocumentParamRef.current = null;
      return;
    }
    if (hydratedDocumentParamRef.current === documentIdParam) return;
    const hasDocument = documents.some((doc) => doc.id === documentIdParam);
    if (!hasDocument) return;
    queueMicrotask(() => {
      setSelectedDocId(documentIdParam);
      hydratedDocumentParamRef.current = documentIdParam;
    });
  }, [documentIdParam, documents]);

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

  // Rename topic mutation
  const renameMutation = useMutation({
    mutationFn: ({ topicId, name }: { topicId: string; name: string }) =>
      poolService.renamePoolTopic(topicId, name),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['student-pool-topics'] });
      if (selectedTopic?.id === updated.id) setSelectedTopic(updated);
      setRenamingTopicId(null);
      toast.success('Đã đổi tên chủ đề thành công');
    },
    onError: (error: unknown) => {
      toast.error('Đổi tên thất bại: ' + getErrorMessage(error));
    }
  });

  // AI Quiz Generation mutation
  const generateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof poolService.generatePoolQuiz>[0]) =>
      poolService.generatePoolQuiz(payload),
    onSuccess: (quiz) => {
      setShowGenOverlay(false);
      setGeneratingStep(0);
      toast.success(`Đã tạo thành công ${quiz.questionCount} câu ôn tập vào Pool cá nhân!`);
      queryClient.invalidateQueries({ queryKey: ['student-pool-topics'] });
      if (selectedTopic) {
        queryClient.invalidateQueries({ queryKey: ['quizzes-in-topic', selectedTopic.id] });
      }
      setTopicName('');
      setUserSuggestion('');
      setSelectedDocId('');
      setActiveTab('pool');
    },
    onError: (error: unknown) => {
      setShowGenOverlay(false);
      setGeneratingStep(0);
      toast.error('Sinh quiz ôn tập thất bại: ' + getErrorMessage(error));
    }
  });

  const handleGenerateQuiz = async () => {
    if (!topicName.trim()) {
      toast.error('Vui lòng nhập tên chủ đề');
      return;
    }
    if (!userSuggestion.trim() && !selectedDocId) {
      toast.error('Vui lòng nhập nội dung muốn ôn tập hoặc chọn tài liệu học tập');
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

    const totalAdvanced = easyCount + mediumCount + hardCount;
    const trimmedSuggestion = userSuggestion.trim();
    generateMutation.mutate({
      topicName: topicName.trim(),
      userSuggestion: trimmedSuggestion || undefined,
      documentId: selectedDocId || undefined,
      numQuestions: isAdvanced ? totalAdvanced : numQuestions,
      difficulty: isAdvanced ? 'mixed' : difficulty,
      mode: genMode,
      numEasyQuestions: isAdvanced ? easyCount : undefined,
      numMediumQuestions: isAdvanced ? mediumCount : undefined,
      numHardQuestions: isAdvanced ? hardCount : undefined,
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

      queryClient.invalidateQueries({ queryKey: ['my-documents'] });
      setSelectedDocId(documentId);
      toast.success(`Đã tải lên tài liệu ${file.name} thành công!`);
    } catch (error: unknown) {
      toast.error('Tải tài liệu lên thất bại: ' + getErrorMessage(error));
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
    onError: (error: unknown) => {
      toast.error('Tạo bộ ôn tập thất bại: ' + getErrorMessage(error));
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
      setDeleteQuizId(null);
      queryClient.invalidateQueries({ queryKey: ['student-pool-topics'] });
      if (selectedTopic) {
        queryClient.invalidateQueries({ queryKey: ['quizzes-in-topic', selectedTopic.id] });
      }
      setSelectedPoolQuizIds(prev => prev.filter(id => !quizzes.some(q => q.quizId === id)));
    },
    onError: (error: unknown) => {
      toast.error('Xóa thất bại: ' + getErrorMessage(error));
    }
  });

  // Revision set delete mutation
  const deleteRevisionMutation = useMutation({
    mutationFn: (quizId: string) => poolService.deletePoolQuiz(quizId), // private quiz deletion is same API
    onSuccess: () => {
      toast.success('Đã xóa Bộ ôn tập');
      setDeleteRevisionId(null);
      queryClient.invalidateQueries({ queryKey: ['student-revision-sets'] });
    },
    onError: (error: unknown) => {
      toast.error('Xóa bộ ôn tập thất bại: ' + getErrorMessage(error));
    }
  });

  // Redirect to server-backed practice session (updates BKT, SR, streak)
  const navigateToPractice = (
    title: string,
    questions: { id: string }[],
    topicId?: string,
  ) => {
    if (!questions.length) {
      toast.error('Bộ ôn tập này chưa có câu hỏi nào!');
      return;
    }

    const params = new URLSearchParams({
      mode: 'fixed',
      topicName: title,
      questionIds: questions.map((q) => q.id).join(','),
    });
    if (topicId) params.set('topicId', topicId);
    navigate(`/student/practice-session?${params.toString()}`);
  };

  const startPoolQuiz = (quiz: PoolQuizDetailDto) => {
    if (!selectedTopic?.id) {
      toast.error('Chọn chủ đề trước khi làm bài');
      return;
    }
    navigateToPractice(quiz.title, quiz.questions, selectedTopic.id);
  };

  const startRevisionKit = async (kit: { id: string; title: string }) => {
    try {
      toast.info('Đang chuẩn bị câu hỏi ôn tập...');
      const questions = await quizzesService.getMyQuizQuestions(kit.id);
      navigateToPractice(kit.title, questions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tải bộ câu hỏi';
      toast.error(message);
    }
  };

  return (
    <div className="relative min-h-[85vh] text-foreground">
      <PoolDashboardHeader activeTab={activeTab} onTabChange={setActiveTab} />

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
                    {topics.map((t) => {
                      const isRenaming = renamingTopicId === t.id;
                      const canRename = !t.classId; // private topics only for students
                      return (
                        <div
                          key={t.id}
                          onClick={() => !isRenaming && setSelectedTopic(t)}
                          className={cn(
                            'group rounded-xl p-3 border transition-all duration-300',
                            isRenaming ? 'border-indigo-500/50 bg-indigo-500/5' :
                            selectedTopic?.id === t.id
                              ? 'cursor-pointer bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent border-indigo-500/50 shadow-md shadow-indigo-500/5'
                              : 'cursor-pointer border-border/40 hover:bg-muted/40 hover:border-border'
                          )}
                        >
                          <div className="flex justify-between items-start gap-2">
                            {isRenaming ? (
                              <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') renameMutation.mutate({ topicId: t.id, name: renameValue });
                                    if (e.key === 'Escape') setRenamingTopicId(null);
                                  }}
                                  className="flex-1 text-sm bg-transparent border-b border-indigo-500 outline-none pb-0.5"
                                />
                                <button
                                  onClick={() => renameMutation.mutate({ topicId: t.id, name: renameValue })}
                                  disabled={renameMutation.isPending || !renameValue.trim()}
                                  className="text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => setRenamingTopicId(null)} className="text-muted-foreground hover:text-foreground">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <span className="font-semibold text-sm group-hover:text-indigo-600 transition-colors truncate">
                                  {t.name}
                                </span>
                                {canRename && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenamingTopicId(t.id);
                                      setRenameValue(t.name);
                                    }}
                                    className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-indigo-600 transition-opacity"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            )}
                            {!isRenaming && (
                              <Badge variant="outline" className="shrink-0 text-[10px] py-0 px-1 border-indigo-500/20 text-indigo-700">
                                {t.difficulty === 'easy' ? 'Dễ' : t.difficulty === 'medium' ? 'TB' : 'Khó'}
                              </Badge>
                            )}
                          </div>
                          {!isRenaming && (
                            <>
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                                {t.description || 'Không có mô tả.'}
                              </p>
                              <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/20 pt-1.5">
                                <span>{t.quizCount} đợt sinh</span>
                                <span className="font-medium text-indigo-700/90">{t.questionCount} câu hỏi</span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
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
                        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-primary-foreground">Chủ đề ôn luyện</Badge>
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
                                  <p className="font-semibold text-sm cursor-pointer hover:text-indigo-600 transition-colors truncate">
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
                                  className="text-xs h-8 hover:bg-indigo-500/10 hover:text-indigo-600"
                                  onClick={() => startPoolQuiz(quiz)}
                                >
                                  <Play className="h-3 w-3 mr-1" /> Làm bài
                                </Button>
                                <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                   onClick={() => setDeleteQuizId(quiz.quizId)}
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
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 text-xs font-bold shrink-0 mt-0.5">
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
                                              ? "bg-emerald-50 text-emerald-800 border-emerald-500 font-semibold ring-1 ring-emerald-500/20"
                                              : "bg-muted/30 text-muted-foreground border-border/60"
                                          )}
                                        >
                                          <span className={cn(
                                            "mr-1.5 font-bold",
                                            opt.isCorrect ? "text-emerald-600" : "text-muted-foreground/60"
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
              <Trophy className="h-5 w-5 text-indigo-600" />
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
                      <Badge className="bg-indigo-600/10 text-indigo-700 border-indigo-500/20 text-[10px]">
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
                        onClick={() => setDeleteRevisionId(kit.id)}
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
                        onClick={() => startRevisionKit(kit)}
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
              <Sparkles className="h-5 w-5 text-indigo-600" />
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
                * Nhập trùng tên chủ đề đã có để sinh thêm vào, hoặc chọn chế độ "Thay thế" bên dưới.
              </p>
            </div>

            <div className="space-y-2 animate-fadeIn">
              <Label className="text-sm font-semibold">2. Nhập mô tả những gì bạn muốn ôn tập (Tùy chọn)</Label>
              <Textarea
                placeholder="Ví dụ: Tạo 10 câu hỏi trắc nghiệm về phương trình bậc 2 và bất phương trình kèm giải thích dễ hiểu..."
                value={userSuggestion}
                onChange={(e) => setUserSuggestion(e.target.value)}
                rows={4}
                className="bg-muted/30 focus-visible:ring-indigo-500"
              />
              <p className="text-[10px] text-muted-foreground italic">
                * Có thể để trống nếu đã chọn tài liệu ở bước 3.
              </p>
            </div>

            <div className="space-y-3 animate-fadeIn">
              <Label className="text-sm font-semibold">3. Chọn giáo trình / ghi chú đã upload (Tùy chọn)</Label>
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
                * Có thể chọn đồng thời tài liệu và gợi ý nội dung. Cần tối thiểu một trong hai nguồn.
              </p>
            </div>

            {/* Difficulty & Number of Questions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Độ khó & Số lượng câu</Label>
                <button
                  type="button"
                  onClick={() => setIsAdvanced(!isAdvanced)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
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
                    Tổng: <strong className="text-indigo-600">{easyCount + mediumCount + hardCount}</strong> câu
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Mức độ</Label>
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
                    <Label className="text-xs text-muted-foreground">Số câu</Label>
                    <select
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                      className="flex h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm ring-offset-background focus-visible:ring-indigo-500"
                    >
                      <option value={3}>3 câu</option>
                      <option value={5}>5 câu</option>
                      <option value={10}>10 câu</option>
                      <option value={15}>15 câu</option>
                      <option value={20}>20 câu</option>
                    </select>
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
                      ? 'border-indigo-500/50 bg-indigo-500/5 font-semibold text-indigo-700'
                      : 'border-border/40 hover:bg-muted/40 text-muted-foreground'
                  )}
                >
                  <div className="font-semibold mb-0.5">Sinh thêm</div>
                  <div className="text-[10px] opacity-70">Giữ câu hỏi cũ, thêm câu mới</div>
                </div>
                <div
                  onClick={() => setGenMode('replace')}
                  className={cn(
                    'cursor-pointer rounded-xl p-3 border text-center text-xs transition-all duration-300',
                    genMode === 'replace'
                      ? 'border-rose-500/50 bg-rose-500/5 font-semibold text-rose-700'
                      : 'border-border/40 hover:bg-muted/40 text-muted-foreground'
                  )}
                >
                  <div className="font-semibold mb-0.5">Thay thế</div>
                  <div className="text-[10px] opacity-70">Xoá câu cũ, sinh câu hỏi mới</div>
                </div>
              </div>
              {genMode === 'replace' && (
                <p className="text-[10px] text-rose-700/90 italic">
                  ⚠ Chế độ thay thế sẽ xoá toàn bộ câu hỏi cũ trong chủ đề này.
                </p>
              )}
            </div>

            <Button
              className="w-full bg-gradient-to-r from-blue-500 via-indigo-600 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-primary-foreground font-semibold py-6 rounded-xl shadow-lg shadow-indigo-500/20"
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

      {selectedPoolQuizIds.length > 0 && activeTab === 'pool' && (
        <RevisionSelectionBar
          count={selectedPoolQuizIds.length}
          onClear={() => setSelectedPoolQuizIds([])}
          onCreate={() => setIsRevisionDialogOpen(true)}
        />
      )}

      <RevisionSetDialog
        open={isRevisionDialogOpen}
        count={selectedPoolQuizIds.length}
        title={revisionTitle}
        pending={createRevisionMutation.isPending}
        onOpenChange={setIsRevisionDialogOpen}
        onTitleChange={setRevisionTitle}
        onSubmit={handleCreateRevision}
      />

      {showGenOverlay && <GenerationProgressOverlay step={generatingStep} />}

      <Dialog open={!!deleteQuizId} onOpenChange={(open) => { if (!open) setDeleteQuizId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa lượt sinh quiz</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa lượt sinh <strong>"{quizzes.find(q => q.quizId === deleteQuizId)?.title}"</strong> khỏi Pool cá nhân?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteQuizId(null)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteQuizId) {
                  deleteQuizMutation.mutate(deleteQuizId);
                }
              }}
              disabled={deleteQuizMutation.isPending}
            >
              {deleteQuizMutation.isPending ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteRevisionId} onOpenChange={(open) => { if (!open) setDeleteRevisionId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa bộ ôn tập</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa Bộ ôn tập <strong>"{revisionSets.find(r => r.id === deleteRevisionId)?.title}"</strong>? Các câu hỏi đã tổng hợp trong bộ này sẽ bị loại bỏ (nhưng vẫn nằm trong Pool gốc).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRevisionId(null)}>Hủy</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteRevisionId) {
                  deleteRevisionMutation.mutate(deleteRevisionId);
                }
              }}
              disabled={deleteRevisionMutation.isPending}
            >
              {deleteRevisionMutation.isPending ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
