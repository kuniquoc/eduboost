import { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { poolService } from '@/features/quiz-pool/api/pool.service';
import { usePoolTopics } from '@/features/quiz-pool/hooks/use-pool-topics';
import { useQuizzesInTopic } from '@/features/quiz-pool/hooks/use-quizzes-in-topic';
import { Card, CardContent } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Separator } from '@/shared/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/shared/ui/dialog';
import {
  Search, Trash2, BookOpen, ChevronDown, ChevronUp, Loader2, Library, HelpCircle, Pencil, Check, X, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { getErrorMessage } from '@/shared/lib/error-message';
import type { TopicPoolDto, PoolQuizDetailDto } from '@/features/quiz-pool/types';
import type { QuestionDto } from '@/features/quizzes/types';

type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';

interface PoolSelectionState {
  questionIds: string[];
  poolQuizIds: string[];
}

export interface PoolQuestionPickerProps {
  classId?: string;
  preferredTopicId?: string;
  selectionMode: 'question' | 'batch';
  selectedQuestionIds: string[];
  selectedPoolQuizIds: string[];
  onSelectionChange: (selection: PoolSelectionState) => void;
  showDifficultyFilter?: boolean;
  showQuestionSearch?: boolean;
  showDeleteButton?: boolean;
  enableTopicRename?: boolean;
  enableQuizRename?: boolean;
  onReviewQuiz?: (quizId: string) => void;
  onSelectedQuestionsChange?: (questions: Array<QuestionDto & { topicName?: string }>) => void;
}

const difficultyLabel: Record<string, string> = {
  easy: 'Dễ',
  medium: 'TB',
  hard: 'Khó',
};

function filterQuizzes(
  quizzes: PoolQuizDetailDto[],
  difficultyFilter: DifficultyFilter,
  questionSearch: string,
): PoolQuizDetailDto[] {
  const qSearch = questionSearch.trim().toLowerCase();

  return quizzes
    .map((quiz) => {
      let questions = quiz.questions;

      if (difficultyFilter !== 'all') {
        questions = questions.filter((q) => q.difficultyBand === difficultyFilter);
      }
      if (qSearch) {
        questions = questions.filter((q) => q.text.toLowerCase().includes(qSearch));
      }

      if (questions.length === 0) return null;
      return { ...quiz, questions };
    })
    .filter((q): q is PoolQuizDetailDto => q !== null);
}

export function PoolQuestionPicker({
  classId,
  preferredTopicId,
  selectionMode,
  selectedQuestionIds,
  selectedPoolQuizIds,
  onSelectionChange,
  showDifficultyFilter = false,
  showQuestionSearch = false,
  showDeleteButton = false,
  enableTopicRename = false,
  enableQuizRename = false,
  onReviewQuiz,
  onSelectedQuestionsChange,
}: PoolQuestionPickerProps) {
  const queryClient = useQueryClient();
  const questionCache = useRef<Map<string, QuestionDto & { topicName?: string }>>(new Map());
  const [search, setSearch] = useState('');
  const [deleteQuizId, setDeleteQuizId] = useState<string | null>(null);
  const [renamingTopicId, setRenamingTopicId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingQuizId, setRenamingQuizId] = useState<string | null>(null);
  const [renameQuizValue, setRenameQuizValue] = useState('');
  const [selectedTopicState, setSelectedTopic] = useState<TopicPoolDto | null>(null);
  const [expandedQuizzes, setExpandedQuizzes] = useState<Record<string, boolean>>({});
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [questionSearch, setQuestionSearch] = useState('');

  const { data: topics = [], isLoading: isLoadingTopics } = usePoolTopics(search, classId);
  const selectedTopic = selectedTopicState && topics.some((topic) => topic.id === selectedTopicState.id)
    ? selectedTopicState
    : topics.find((topic) => topic.id === preferredTopicId) ?? topics[0] ?? null;
  const { data: quizzes = [], isLoading: isLoadingQuizzes } = useQuizzesInTopic(selectedTopic?.id);

  const filteredQuizzes = useMemo(
    () => (showDifficultyFilter || showQuestionSearch)
      ? filterQuizzes(quizzes, difficultyFilter, questionSearch)
      : quizzes,
    [quizzes, difficultyFilter, questionSearch, showDifficultyFilter, showQuestionSearch],
  );

  useEffect(() => {
    if (!selectedTopic) return;
    for (const quiz of quizzes) {
      for (const q of quiz.questions) {
        questionCache.current.set(q.id, { ...q, topicName: selectedTopic.name });
      }
    }
  }, [quizzes, selectedTopic]);

  useEffect(() => {
    if (!onSelectedQuestionsChange) return;
    const selected = selectedQuestionIds
      .map((id) => questionCache.current.get(id))
      .filter((q): q is QuestionDto & { topicName?: string } => !!q);
    onSelectedQuestionsChange(selected);
  }, [selectedQuestionIds, onSelectedQuestionsChange]);

  const deleteQuizMutation = useMutation({
    mutationFn: (quizId: string) => poolService.deletePoolQuiz(quizId),
    onSuccess: (_data, quizId) => {
      toast.success('Đã xóa quiz khỏi Pool');
      setDeleteQuizId(null);
      queryClient.invalidateQueries({ queryKey: ['pool-topics'] });
      if (selectedTopic) {
        queryClient.invalidateQueries({ queryKey: ['quizzes-in-topic', selectedTopic.id] });
      }
      onSelectionChange({
        questionIds: selectedQuestionIds,
        poolQuizIds: selectedPoolQuizIds.filter((id) => id !== quizId),
      });
    },
    onError: (err: Error) => toast.error('Xóa thất bại: ' + err.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ topicId, name }: { topicId: string; name: string }) =>
      poolService.renamePoolTopic(topicId, name),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['pool-topics'] });
      if (selectedTopic?.id === updated.id) setSelectedTopic(updated);
      setRenamingTopicId(null);
      toast.success('Đã đổi tên chủ đề thành công');
    },
    onError: (error: unknown) => {
      toast.error('Đổi tên thất bại: ' + getErrorMessage(error));
    },
  });

  const renameQuizMutation = useMutation({
    mutationFn: ({ quizId, name }: { quizId: string; name: string }) =>
      poolService.renamePoolQuiz(quizId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pool-topics'] });
      if (selectedTopic) {
        queryClient.invalidateQueries({ queryKey: ['quizzes-in-topic', selectedTopic.id] });
      }
      setRenamingQuizId(null);
      toast.success('Đã đổi tên quiz thành công');
    },
    onError: (error: unknown) => {
      toast.error('Đổi tên thất bại: ' + getErrorMessage(error));
    },
  });

  const toggleQuiz = (quizId: string) => {
    setExpandedQuizzes((prev) => ({ ...prev, [quizId]: !prev[quizId] }));
  };

  const handleSelectQuiz = (quizId: string) => {
    if (selectionMode === 'batch') {
      const next = selectedPoolQuizIds.includes(quizId)
        ? selectedPoolQuizIds.filter((id) => id !== quizId)
        : [...selectedPoolQuizIds, quizId];
      onSelectionChange({ questionIds: selectedQuestionIds, poolQuizIds: next });
      return;
    }

    const quiz = quizzes.find((q) => q.quizId === quizId);
    if (!quiz) return;
    const quizQuestionIds = quiz.questions.map((q) => q.id);
    const allSelected = quizQuestionIds.every((id) => selectedQuestionIds.includes(id));

    if (allSelected) {
      onSelectionChange({
        questionIds: selectedQuestionIds.filter((id) => !quizQuestionIds.includes(id)),
        poolQuizIds: selectedPoolQuizIds,
      });
    } else {
      const merged = new Set([...selectedQuestionIds, ...quizQuestionIds]);
      onSelectionChange({
        questionIds: Array.from(merged),
        poolQuizIds: selectedPoolQuizIds,
      });
    }
  };

  const handleSelectQuestion = (question: QuestionDto) => {
    const next = selectedQuestionIds.includes(question.id)
      ? selectedQuestionIds.filter((id) => id !== question.id)
      : [...selectedQuestionIds, question.id];
    onSelectionChange({ questionIds: next, poolQuizIds: selectedPoolQuizIds });
  };

  const handleSelectAllInTopic = () => {
    if (!filteredQuizzes.length) return;

    if (selectionMode === 'batch') {
      const allQuizIds = filteredQuizzes.map((q) => q.quizId);
      const allSelected = allQuizIds.every((id) => selectedPoolQuizIds.includes(id));
      onSelectionChange({
        questionIds: selectedQuestionIds,
        poolQuizIds: allSelected
          ? selectedPoolQuizIds.filter((id) => !allQuizIds.includes(id))
          : Array.from(new Set([...selectedPoolQuizIds, ...allQuizIds])),
      });
      return;
    }

    const allQuestionIds = filteredQuizzes.flatMap((q) => q.questions.map((qu) => qu.id));
    const allSelected = allQuestionIds.every((id) => selectedQuestionIds.includes(id));
    onSelectionChange({
      questionIds: allSelected
        ? selectedQuestionIds.filter((id) => !allQuestionIds.includes(id))
        : Array.from(new Set([...selectedQuestionIds, ...allQuestionIds])),
      poolQuizIds: selectedPoolQuizIds,
    });
  };

  const isQuizSelected = (quiz: PoolQuizDetailDto) => {
    if (selectionMode === 'batch') {
      return selectedPoolQuizIds.includes(quiz.quizId);
    }
    return quiz.questions.length > 0 && quiz.questions.every((q) => selectedQuestionIds.includes(q.id));
  };

  const isQuizPartiallySelected = (quiz: PoolQuizDetailDto) => {
    if (selectionMode === 'batch') return false;
    const selected = quiz.questions.filter((q) => selectedQuestionIds.includes(q.id)).length;
    return selected > 0 && selected < quiz.questions.length;
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
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
                {topics.map((t) => {
                  const isRenaming = enableTopicRename && renamingTopicId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => !isRenaming && setSelectedTopic(t)}
                      className={cn(
                        'group rounded-xl p-3 border transition-all duration-300',
                        isRenaming
                          ? 'border-purple-500/50 bg-purple-500/5'
                          : selectedTopic?.id === t.id
                            ? 'cursor-pointer bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border-purple-500/50 shadow-md shadow-purple-500/5'
                            : 'cursor-pointer border-border/40 hover:bg-muted/40 hover:border-border',
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
                              className="flex-1 text-sm bg-transparent border-b border-purple-500 outline-none pb-0.5"
                            />
                            <button
                              onClick={() => renameMutation.mutate({ topicId: t.id, name: renameValue })}
                              disabled={renameMutation.isPending || !renameValue.trim()}
                              className="text-purple-400 hover:text-purple-300 disabled:opacity-40"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => setRenamingTopicId(null)} className="text-muted-foreground hover:text-foreground">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className="font-semibold text-sm group-hover:text-purple-400 transition-colors truncate">
                              {t.name}
                            </span>
                            {enableTopicRename && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingTopicId(t.id);
                                  setRenameValue(t.name);
                                }}
                                className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-purple-400 transition-opacity"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                        {!isRenaming && (
                          <Badge variant="outline" className="shrink-0 text-[10px] py-0 px-1 border-purple-500/20 text-purple-300">
                            {difficultyLabel[t.difficulty] ?? t.difficulty}
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
                            <span className="font-medium text-purple-300/80">{t.questionCount} câu hỏi</span>
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

      <div className="lg:col-span-8 space-y-4">
        {selectedTopic ? (
          <Card className="border-border bg-card/60 backdrop-blur-sm shadow-xl min-h-[62vh] flex flex-col">
            <CardContent className="p-5 flex-1 flex flex-col">
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
                    disabled={!filteredQuizzes.length}
                    className="text-xs font-semibold hover:border-purple-500/40"
                  >
                    {filteredQuizzes.length > 0 && (
                      selectionMode === 'batch'
                        ? filteredQuizzes.every((q) => selectedPoolQuizIds.includes(q.quizId))
                        : filteredQuizzes.flatMap((q) => q.questions).every((q) => selectedQuestionIds.includes(q.id))
                    )
                      ? 'Bỏ chọn tất cả'
                      : 'Chọn tất cả chủ đề'}
                  </Button>
                </div>
              </div>

              {(showDifficultyFilter || showQuestionSearch) && (
                <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
                  {showDifficultyFilter && (
                    <div className="flex flex-wrap gap-1.5">
                      {(['all', 'easy', 'medium', 'hard'] as const).map((d) => (
                        <Button
                          key={d}
                          type="button"
                          size="sm"
                          variant={difficultyFilter === d ? 'default' : 'outline'}
                          className="h-7 text-xs"
                          onClick={() => setDifficultyFilter(d)}
                        >
                          {d === 'all' ? 'Tất cả' : difficultyLabel[d]}
                        </Button>
                      ))}
                    </div>
                  )}
                  {showQuestionSearch && (
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Tìm nội dung câu hỏi..."
                        value={questionSearch}
                        onChange={(e) => setQuestionSearch(e.target.value)}
                        className="pl-9 h-9 text-sm bg-muted/30"
                      />
                    </div>
                  )}
                </div>
              )}

              {isLoadingQuizzes ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-3" />
                  <p className="text-sm text-muted-foreground">Đang tải preview câu hỏi...</p>
                </div>
              ) : filteredQuizzes.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
                  <HelpCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
                  <p className="text-lg font-medium">Không có câu hỏi phù hợp</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {quizzes.length === 0
                      ? 'Chủ đề này chưa có câu hỏi. Hãy sinh quiz AI trước.'
                      : 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.'}
                  </p>
                </div>
              ) : (
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[50vh] pr-1">
                  {filteredQuizzes.map((quiz) => {
                    const isExpanded = expandedQuizzes[quiz.quizId] ?? (selectionMode === 'question');
                    const selected = isQuizSelected(quiz);
                    const partial = isQuizPartiallySelected(quiz);

                    return (
                      <div
                        key={quiz.quizId}
                        className={cn(
                          'border rounded-xl transition-all duration-300 overflow-hidden',
                          selected
                            ? 'border-purple-500/40 bg-purple-500/5 shadow-inner'
                            : partial
                              ? 'border-purple-500/20 bg-purple-500/[0.02]'
                              : 'border-border/40 bg-muted/10 hover:border-border/80',
                        )}
                      >
                        <div className="flex items-center justify-between p-3 gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={selected}
                              ref={(el) => { if (el) el.indeterminate = partial; }}
                              onChange={() => handleSelectQuiz(quiz.quizId)}
                              className="h-4.5 w-4.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer shrink-0"
                            />
                            {enableQuizRename && renamingQuizId === quiz.quizId ? (
                              <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  autoFocus
                                  value={renameQuizValue}
                                  onChange={(e) => setRenameQuizValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') renameQuizMutation.mutate({ quizId: quiz.quizId, name: renameQuizValue });
                                    if (e.key === 'Escape') setRenamingQuizId(null);
                                  }}
                                  className="h-8 text-xs bg-muted/20 border border-purple-500 outline-none px-2 rounded"
                                />
                                <button
                                  onClick={() => renameQuizMutation.mutate({ quizId: quiz.quizId, name: renameQuizValue })}
                                  disabled={renameQuizMutation.isPending || !renameQuizValue.trim()}
                                  className="text-purple-400 hover:text-purple-300 disabled:opacity-40"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => setRenamingQuizId(null)} className="text-muted-foreground hover:text-foreground">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="min-w-0 flex-1 group/quiz flex items-center justify-between gap-1.5">
                                <div className="min-w-0 flex-1" onClick={() => toggleQuiz(quiz.quizId)}>
                                  <p className="font-semibold text-sm cursor-pointer hover:text-purple-400 transition-colors truncate">
                                    {quiz.title}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {quiz.questions.length} câu hỏi · {new Date(quiz.createdAt).toLocaleDateString('vi-VN')}
                                  </p>
                                </div>
                                {enableQuizRename && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenamingQuizId(quiz.quizId);
                                      setRenameQuizValue(quiz.title);
                                    }}
                                    className="shrink-0 opacity-0 group-hover/quiz:opacity-100 text-muted-foreground hover:text-purple-400 transition-opacity"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {onReviewQuiz && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs hover:bg-purple-500/10 hover:text-purple-400"
                                aria-label={`Kiểm duyệt ${quiz.title}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onReviewQuiz(quiz.quizId);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5 sm:mr-1" />
                                <span className="hidden sm:inline">Kiểm duyệt</span>
                              </Button>
                            )}
                            {showDeleteButton && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteQuizId(quiz.quizId)}
                                disabled={deleteQuizMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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

                        {isExpanded && (
                          <div className="border-t border-border/30 bg-card/40 p-4 space-y-4">
                            {quiz.questions.map((q, idx) => (
                              <div key={q.id} className="space-y-2 border-b border-border/20 last:border-0 pb-3 last:pb-0">
                                <div className="flex items-start gap-2">
                                  {selectionMode === 'question' && (
                                    <input
                                      type="checkbox"
                                      checked={selectedQuestionIds.includes(q.id)}
                                      onChange={() => handleSelectQuestion(q)}
                                      className="h-4 w-4 mt-0.5 rounded accent-purple-600 cursor-pointer shrink-0"
                                    />
                                  )}
                                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs md:text-sm font-medium">{q.text}</p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      <Badge variant="outline" className="text-[10px] py-0">
                                        {difficultyLabel[q.difficultyBand] ?? q.difficultyBand}
                                      </Badge>
                                      {typeof q.irtBeta === 'number' && (
                                        <Badge variant="secondary" className="text-[10px] py-0">
                                          β {q.irtBeta.toFixed(2)}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-7">
                                  {q.options.map((opt) => (
                                    <div
                                      key={opt.id}
                                      className={cn(
                                        'rounded-lg px-2.5 py-1.5 text-xs border',
                                        opt.isCorrect
                                          ? 'bg-green-500/10 text-green-400 border-green-500/30 font-semibold'
                                          : 'bg-muted/10 text-muted-foreground border-transparent',
                                      )}
                                    >
                                      <span className="mr-1">{opt.isCorrect ? '✓' : '○'}</span> {opt.text}
                                    </div>
                                  ))}
                                </div>
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
                Chọn một chủ đề ở bảng bên trái để xem các đợt sinh câu hỏi AI.
              </p>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={!!deleteQuizId} onOpenChange={(open) => { if (!open) setDeleteQuizId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa lượt sinh quiz khỏi Pool</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa lượt sinh <strong>"{quizzes.find(q => q.quizId === deleteQuizId)?.title}"</strong>? Các câu hỏi của lượt sinh này sẽ bị xóa khỏi Pool của chủ đề.
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
    </div>
  );
}
