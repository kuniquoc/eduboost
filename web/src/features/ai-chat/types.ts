export interface AskResponse {
  answer: string;
  sources: SourceReferenceDto[];
  messageId: string;
}

export interface SourceReferenceDto {
  documentId: string;
  fileName: string;
  snippet?: string;
}

export interface ChatMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: SourceReferenceDto[];
  createdAt: string;
}

export interface ChatHistoryDto {
  total: number;
  messages: ChatMessageDto[];
}
