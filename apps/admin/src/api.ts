import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key && import.meta.env.VITE_API_URL);
export const supabase = createClient(url || 'https://not-configured.supabase.co', key || 'not-configured', { auth: { storageKey: 'makko-admin-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
export class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export async function api<T>(path: string, signal?: AbortSignal, body?: unknown, expectedUserId?: string): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session)
        throw new ApiError(401, 'Phiên đăng nhập đã hết hạn.');
    if (expectedUserId && session.user.id !== expectedUserId) throw new ApiError(401, 'Tài khoản đã thay đổi. Vui lòng mở lại thực đơn.');
    const response = await fetch(`${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/v1${path}`, { signal, method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${session.access_token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json().catch(() => null);
    if (!response.ok)
        throw new ApiError(response.status, typeof data?.detail === 'string' ? data.detail : response.status === 422 ? 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.' : 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
    return data;
}
export type OrderType = 'weekly' | 'errand';
export type Order = {
    id: string;
    type: OrderType;
    title: string;
    status: string;
    customerId: string;
    customerName: string;
    shopperId: string | null;
    shopperName: string | null;
    price: number | null;
    fee: number;
    deliveryDeadline: string | null;
    createdAt: string;
    completedAt: string | null;
    handoverAt: string | null;
    wagePaidAt: string | null;
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
};
export type MenuIngredient = { name: string; quantity: string };
export type Detail = Order & {
    items: {
        name: string;
        quantity: number;
        unit: string;
        note: string | null;
    }[];
    history: {
        status: string;
        createdAt: string;
    }[];
    ingredients: MenuIngredient[] | null;
};
export type OrderList = {
    items: Order[];
    total: number;
    stats: {
        total: number;
        handover: number;
        delivering: number;
        wages: number;
    };
};
