import { apiClient } from '@/shared/api/client';
import type { ApiResponse } from '@/shared/api/types';
import type { AskResponse, ChatHistoryDto } from '@/features/ai-chat/types';

export const aiChatService = {
  ask: async (question: string, topicId?: string): Promise<AskResponse> => {
    const res = await apiClient.post<ApiResponse<AskResponse>>('/ai-chat/ask', {
      question,
      topicId,
    });
    return res.data.data!;
  },

  getHistory: async (page = 1, pageSize = 20): Promise<ChatHistoryDto> => {
    const res = await apiClient.get<ApiResponse<ChatHistoryDto>>('/ai-chat/history', {
      params: { page, pageSize },
    });
    return res.data.data!;
  },

  clearHistory: async (): Promise<void> => {
    await apiClient.delete('/ai-chat/history');
  },
};
