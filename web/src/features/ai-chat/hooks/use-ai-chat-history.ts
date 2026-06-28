import { useQuery } from '@tanstack/react-query';
import { aiChatService } from '@/features/ai-chat/api/ai-chat.service';

export function useAiChatHistory(page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['ai-chat-history', page, pageSize],
    queryFn: () => aiChatService.getHistory(page, pageSize),
  });
}
