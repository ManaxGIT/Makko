import { invalidateOrderLists } from '@/features/orders/listCache';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import type { OrderActionResult } from '@/features/orders/api';
import type { OrderAddressSnapshot } from '@/features/addresses/addressForm';
import type { RecipeSnapshot } from '@/features/meals/api';
import type { RequestForm } from './CreateRequestProvider';

export type CreateRequestBody = {
  recipe?: RecipeSnapshot;
  submissionKey: string;
  title: string | null;
  addressId: string | null;
  items: Array<{ name: string; quantity: string; unit: string; note: string | null; allowSubstitution: boolean }>;
  deliverBy: string;
  estimatedItemsTotal: string | null;
  deliveryFee: string;
  paymentMethod: 'cash' | 'bank_transfer';
  deliveryNote: string | null;
};

export function buildRequestBody(form: RequestForm, submissionKey: string, now = new Date(), editing = false): CreateRequestBody {
  const title = (form.title ?? '').trim();
  if (title && (Array.from(title).length < 3 || Array.from(title).length > 120)) throw new Error('Tiêu đề cần từ 3 đến 120 ký tự.');
  if (!form.savedAddress?.id && !(editing && form.orderAddress)) throw new Error('Vui lòng lưu địa chỉ nhận hàng trước khi đăng.');
  if (!form.items.length || form.items.length > 100) throw new Error('Danh sách cần có từ 1 đến 100 vật phẩm.');
  const items = form.items.map(item => {
    const quantity = item.quantity.replace(',', '.');
    if (!item.name.trim() || item.name.trim().length > 160 || !item.unit.trim() || item.unit.trim().length > 30
      || !/^\d+(?:\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0 || Number(quantity) >= 10000000
      || item.note.length > 500) throw new Error('Kiểm tra tên vật phẩm, số lượng và đơn vị mua.');
    return { name: item.name.trim(), quantity, unit: item.unit.trim(), note: item.note.trim() || null, allowSubstitution: item.allowSubstitution };
  });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) throw new Error('Giờ giao cần có định dạng HH:mm.');
  const target = editing && form.originalDeliverBy ? new Date(form.originalDeliverBy) : new Date(now);
  if (!(editing && form.originalDeliverBy) && form.day === 'tomorrow') target.setDate(target.getDate() + 1);
  const [hour, minute] = form.time.split(':').map(Number);
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) throw new Error('Giờ giao đã qua. Chọn giờ muộn hơn hoặc ngày mai.');
  if (!form.budget || Number(form.budget) <= 0) throw new Error('Nhập tiền mua hàng lớn hơn 0đ để chốt trước khi đăng.');
  if (!/^\d{1,10}$/.test(form.fee) || (form.budget && !/^\d{1,10}$/.test(form.budget))) throw new Error('Tiền hàng và phí đi chợ phải là số tiền hợp lệ.');
  return {
    ...(!editing && form.recipe ? { recipe: form.recipe } : {}),
    submissionKey, title: title || null, addressId: form.savedAddress?.id ?? null, items, deliverBy: target.toISOString(),
    estimatedItemsTotal: form.budget || null, deliveryFee: form.fee,
    paymentMethod: form.payment, deliveryNote: form.deliveryNote.trim() || null,
  };
}

export function createAndPublishRequest(body: CreateRequestBody, userId: string) {
  return apiPost<OrderActionResult>('/api/v1/orders', body, userId).then(result => { invalidateOrderLists(); return result; });
}

export type EditableRequest = {
  id: string; title: string; updatedAt: string; address: OrderAddressSnapshot;
  items: Array<{ id: string; name: string; quantity: string; unit: string; note: string | null; allowSubstitution: boolean }>;
  deliverBy: string | null; estimatedItemsTotal: number | null; deliveryFee: number;
  paymentMethod: 'cash' | 'bank_transfer'; deliveryNote: string | null;
};
export type EditRequestBody = CreateRequestBody & { expectedUpdatedAt: string; items: Array<CreateRequestBody['items'][number] & { id?: string }> };
export function getEditableRequest(id: string) { return apiGet<EditableRequest>(`/api/v1/orders/${id}/edit`); }
export function updateRequest(id: string, body: EditRequestBody, userId: string) {
  return apiPatch<OrderActionResult>(`/api/v1/orders/${id}`, body, userId).then(result => { invalidateOrderLists(); return result; });
}
