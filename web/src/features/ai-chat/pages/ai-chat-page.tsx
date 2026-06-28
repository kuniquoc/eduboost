import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiChatService } from '@/features/ai-chat/api/ai-chat.service';
import { useAiChatHistory } from '@/features/ai-chat/hooks/use-ai-chat-history';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import {
  Bot,
  Send,
  Loader2,
  Trash2,
  FileText,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ChatMessageDto, AskResponse, SourceReferenceDto } from '@/features/ai-chat/types';

function createOptimisticMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `optimistic-${crypto.randomUUID()}`;
  }
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSourceLabel(source: SourceReferenceDto, index: number) {
  const fileName = source.fileName?.trim();
  if (fileName) return fileName;

  if (source.documentId?.trim()) return `Tài liệu ${index + 1}`;

  return `Nguồn ${index + 1}`;
}

export function AiChatPage() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessageDto[] | null>(null);

  const { data: history, isLoading } = useAiChatHistory();
  const displayedMessages = useMemo(
    () => localMessages ?? history?.messages ?? [],
    [localMessages, history?.messages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedMessages]);

  const askMutation = useMutation({
    mutationFn: (question: string) => aiChatService.ask(question),
    onMutate: (question) => {
      const userMsg: ChatMessageDto = {
        id: createOptimisticMessageId(),
        role: 'user',
        content: question,
        sources: [],
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...(prev ?? history?.messages ?? []), userMsg]);
    },
    onSuccess: (data: AskResponse) => {
      const assistantMsg: ChatMessageDto = {
        id: data.messageId,
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...(prev ?? history?.messages ?? []), assistantMsg]);
      queryClient.invalidateQueries({ queryKey: ['ai-chat-history'] });
    },
    onError: () => {
      toast.error('Không thể gửi câu hỏi. Vui lòng thử lại.');
      setLocalMessages((prev) => (prev ? prev.slice(0, -1) : prev)); // Remove optimistic user msg
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => aiChatService.clearHistory(),
    onSuccess: () => {
      setLocalMessages([]);
      queryClient.invalidateQueries({ queryKey: ['ai-chat-history'] });
      toast.success('Đã xóa lịch sử trò chuyện');
    },
  });

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || askMutation.isPending) return;
    setInput('');
    askMutation.mutate(text);
  }, [input, askMutation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">AI Trợ giảng</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clearMutation.mutate()}
          disabled={clearMutation.isPending || displayedMessages.length === 0}
        >
          <Trash2 className="mr-1 h-4 w-4" /> Xóa
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bot className="h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              Hỏi bất cứ điều gì về bài học
            </p>
            <p className="text-sm text-muted-foreground">
              AI sẽ trả lời dựa trên tài liệu lớp học của bạn (RAG)
            </p>
          </div>
        ) : (
          displayedMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                {msg.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {msg.sources.map((src, i) => (
                      <Badge
                        key={`${src.documentId || src.fileName || 'source'}-${i}`}
                        variant="secondary"
                        className="max-w-full text-xs"
                        title={src.snippet || getSourceLabel(src, i)}
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        <span className="max-w-48 truncate">{getSourceLabel(src, i)}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))
        )}
        {askMutation.isPending && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-lg bg-muted px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t px-6 py-4">
        <div className="flex gap-2">
          <Input
            placeholder="Nhập câu hỏi..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={askMutation.isPending}
          />
          <Button onClick={handleSend} disabled={!input.trim() || askMutation.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
