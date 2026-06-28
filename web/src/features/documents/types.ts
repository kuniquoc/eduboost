type DocumentStatus =
  | 'pending'
  | 'uploading'
  | 'ingesting'
  | 'processing'
  | 'ready'
  | 'ingest_failed'
  | 'error';

export interface DocumentDto {
  id: string;
  ownerId: string;
  name: string;
  size: string;
  status: DocumentStatus;
  uploadedAt: string;
  topicId?: string;
  generatedQuizId?: string;
  classId?: string;
  isVisible: boolean;
}

export interface UploadUrlDto {
  uploadUrl: string;
  documentId: string;
}

export interface DownloadUrlDto {
  downloadUrl: string;
  expiresAt: string;
}

export interface GenerateQuizJobDto {
  jobId: string;
  documentId?: string;
  quizId?: string;
  topicName?: string;
  status: 'queued' | 'processing' | 'done' | 'error' | 'completed';
  message?: string;
}
