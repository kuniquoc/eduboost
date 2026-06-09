import { useQuery } from '@tanstack/react-query';
import { aiChatService } from '@/services/aiChat.service';

export function useAiChatHistory(page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['ai-chat-history', page, pageSize],
    queryFn: () => aiChatService.getHistory(page, pageSize),
  });
}
