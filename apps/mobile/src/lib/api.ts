import { supabase } from '@/lib/supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}

type QueryParams = Record<string, string | number | null | undefined>;

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, options: { params?: QueryParams; body?: unknown; expectedUserId?: string } = {}): Promise<T> {
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL chưa được cấu hình.');

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error('Bạn cần đăng nhập lại.');
  if (options.expectedUserId && session.user.id !== options.expectedUserId) {
    throw new Error('Tài khoản đã thay đổi. Vui lòng thử lại.');
  }

  const query = Object.entries(options.params ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  const response = await fetch(`${apiUrl}${path}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json().catch(() => null) as { detail?: string } | T | null;
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload ? payload.detail : null;
    throw new ApiError(typeof detail === 'string' ? detail : `API trả về lỗi ${response.status}.`, response.status);
  }
  return payload as T;
}

export function apiGet<T>(path: string, params?: QueryParams, expectedUserId?: string) {
  return apiRequest<T>('GET', path, { params, expectedUserId });
}

export function apiPost<T>(path: string, body?: unknown, expectedUserId?: string) {
  return apiRequest<T>('POST', path, { body, expectedUserId });
}

export function apiPatch<T>(path: string, body: unknown, expectedUserId?: string) {
  return apiRequest<T>('PATCH', path, { body, expectedUserId });
}

export function apiDelete<T>(path: string, params?: QueryParams, expectedUserId?: string) {
  return apiRequest<T>('DELETE', path, { params, expectedUserId });
}
