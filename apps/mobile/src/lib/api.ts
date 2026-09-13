import { supabase } from '@/lib/supabase';

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

type QueryParams = Record<string, string | number | null | undefined>;

async function apiRequest<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options: { params?: QueryParams; body?: unknown } = {}): Promise<T> {
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL chưa được cấu hình.');

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) throw new Error('Bạn cần đăng nhập lại.');

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
    throw new Error(detail || `API trả về lỗi ${response.status}.`);
  }
  return payload as T;
}

export function apiGet<T>(path: string, params?: QueryParams) {
  return apiRequest<T>('GET', path, { params });
}

export function apiPost<T>(path: string, body?: unknown) {
  return apiRequest<T>('POST', path, { body });
}

export function apiPatch<T>(path: string, body: unknown) {
  return apiRequest<T>('PATCH', path, { body });
}
