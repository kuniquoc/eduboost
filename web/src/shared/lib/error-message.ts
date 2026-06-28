export function getErrorMessage(error: unknown, fallback = 'Đã xảy ra lỗi'): string {
  if (error instanceof Error && error.message) return error.message;
  if (!error || typeof error !== 'object') return fallback;

  const response = 'response' in error ? error.response : undefined;
  if (!response || typeof response !== 'object' || !('data' in response)) return fallback;
  const data = response.data;
  if (!data || typeof data !== 'object' || !('message' in data)) return fallback;
  return typeof data.message === 'string' ? data.message : fallback;
}
