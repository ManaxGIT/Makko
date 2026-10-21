import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { DeliveryAddress, fromSavedAddress, isDeliveryAddressComplete } from '@/features/addresses/addressForm';
import { getPreferredAddress, saveAddress, SavedAddress } from '@/features/addresses/api';
import { getHomeDashboard } from '@/features/home/api';
import { ApiError } from '@/lib/api';
import { buildRequestBody, createAndPublishRequest, CreateRequestBody, EditRequestBody, getEditableRequest, updateRequest } from './api';
import type { OrderActionResult } from '@/features/orders/api';
import { useAuth } from '@/features/auth/AuthProvider';

export type RequestItem = { id: string; name: string; quantity: string; unit: string; note: string; allowSubstitution: boolean };
export type RequestForm = DeliveryAddress & { title: string; originalDeliverBy?: string | null; items: RequestItem[]; day: 'today' | 'tomorrow'; time: string; budget: string; fee: string; payment: 'cash' | 'bank_transfer'; deliveryNote: string };
// Start with an empty shopping list; this flow publishes real requests.
const initialForm = (): RequestForm => ({
  title: '', items: [], phone: '', line1: '', province: null, ward: null, day: 'today', time: '18:00', budget: '', fee: '25000', payment: 'cash', deliveryNote: '',
});
type FormContext = {
  form: RequestForm;
  editId?: string;
  editLoading: boolean;
  editError: string;
  reloadEdit: () => void;
  patch: (value: Partial<RequestForm>) => void;
  reset: () => void;
  addressLoading: boolean;
  addressError: string;
  savingAddress: boolean;
  reloadAddress: () => void;
  saveDeliveryAddress: (address: DeliveryAddress) => Promise<void>;
  publishRequest: () => Promise<OrderActionResult>;
  publishing: boolean;
  requestLocked: boolean;
  publishedRequest: OrderActionResult | null;
};
const Context = createContext<FormContext | null>(null);

export function CreateRequestProvider({ children, editId }: PropsWithChildren<{ editId?: string }>) {
  const { session } = useAuth();
  const userId = session?.user.id;
  // Never reuse in-memory form/address data across accounts or after sign-out.
  return <AccountRequestProvider key={`${userId ?? 'signed-out'}:${editId ?? 'new'}`} userId={userId} editId={editId}>{children}</AccountRequestProvider>;
}

function AccountRequestProvider({ children, userId, editId }: PropsWithChildren<{ userId?: string; editId?: string }>) {
  const [editLoading, setEditLoading] = useState(!!editId);
  const [editError, setEditError] = useState('');
  const [editAttempt, setEditAttempt] = useState(0);
  const editVersion = useRef('');
  const originalItemIds = useRef(new Set<string>());
  const [form, setForm] = useState(initialForm);
  const [preferred, setPreferred] = useState<SavedAddress | null>(null);
  const [addressLoading, setAddressLoading] = useState(!!userId);
  const [addressError, setAddressError] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);
  const version = useRef(0);
  const saveLock = useRef(false);
  const publishLock = useRef(false);
  const pendingSubmission = useRef<CreateRequestBody | EditRequestBody | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [requestLocked, setRequestLocked] = useState(false);
  const [publishedRequest, setPublishedRequest] = useState<OrderActionResult | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const requestVersion = ++version.current;
    setAddressLoading(true); setAddressError('');
    getPreferredAddress().then(saved => {
      if (!active || requestVersion !== version.current) return;
      setPreferred(saved);
      if (saved && !editId && !pendingSubmission.current) setForm(current => ({ ...current, ...fromSavedAddress(saved) }));
    }).catch(() => {
      if (active && requestVersion === version.current) setAddressError('Không tải được địa chỉ đã lưu. Vui lòng thử lại.');
    }).finally(() => {
      if (active && requestVersion === version.current) setAddressLoading(false);
    });
    return () => { active = false; };
  }, [userId, attempt, editId]);

  useEffect(() => {
    if (!editId || !userId) return;
    let active = true;
    setEditLoading(true); setEditError('');
    getEditableRequest(editId).then(data => {
      if (!active) return;
      editVersion.current = data.updatedAt;
      originalItemIds.current = new Set(data.items.map(i => i.id));
      const date = data.deliverBy ? new Date(data.deliverBy) : null;
      setForm({ ...initialForm(), title: data.title, items: data.items.map(i => ({ ...i, quantity: String(i.quantity), note: i.note ?? '' })),
        phone: data.address.recipientPhone, line1: data.address.line1, orderAddress: data.address,
        originalDeliverBy: data.deliverBy, time: date ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : '18:00',
        budget: data.estimatedItemsTotal === null ? '' : String(data.estimatedItemsTotal), fee: String(data.deliveryFee),
        payment: data.paymentMethod, deliveryNote: data.deliveryNote ?? '',
      });
    }).catch(error => { if (active) setEditError(error instanceof Error ? error.message : 'Không tải được đơn hàng.'); })
      .finally(() => { if (active) setEditLoading(false); });
    return () => { active = false; };
  }, [editId, userId, editAttempt]);

  async function saveDeliveryAddress(address: DeliveryAddress) {
    if (!userId) throw new Error('Bạn cần đăng nhập để lưu địa chỉ.');
    if (pendingSubmission.current) throw new Error('Vui lòng xác nhận kết quả đăng yêu cầu trước khi sửa địa chỉ.');
    if (saveLock.current) throw new Error('Đang lưu địa chỉ, vui lòng chờ.');
    if (!isDeliveryAddressComplete(address)) throw new Error('Vui lòng nhập đầy đủ địa chỉ và số điện thoại.');
    if (address.savedAddress?.id === preferred?.id && preferred) {
      setForm(current => ({ ...current, ...fromSavedAddress(preferred) }));
      return;
    }
    if (!address.province || !address.ward) throw new Error('Vui lòng chọn lại tỉnh/thành và xã/phường.');
    saveLock.current = true;
    setSavingAddress(true);
    ++version.current; // A late initial read must not overwrite the address being saved.
    setAddressLoading(false);
    try {
      const { profile } = await getHomeDashboard({ nearbyLimit: 1 });
      if (!alive.current || profile.id !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng thử lại.');
      if (!profile.displayName.trim()) throw new Error('Vui lòng bổ sung tên trong hồ sơ tài khoản trước khi lưu.');
      const saved = await saveAddress({
        label: 'Nhà', recipientName: profile.displayName.trim(), recipientPhone: address.phone.trim(),
        line1: address.line1.trim(), provinceCode: address.province.code, wardCode: address.ward.code,
        latitude: null, longitude: null, isDefault: true,
      }, userId);
      if (!alive.current) return;
      setPreferred(saved);
      setForm(current => ({ ...current, ...fromSavedAddress(saved) }));
      setAddressError('');
    } finally {
      saveLock.current = false;
      if (alive.current) setSavingAddress(false);
    }
  }

  async function publishRequest(): Promise<OrderActionResult> {
    if (!userId) throw new Error('Bạn cần đăng nhập để đăng yêu cầu.');
    if (editId && (editLoading || editError || !editVersion.current)) throw new Error('Vui lòng tải lại đơn trước khi lưu.');
    if (publishedRequest) return publishedRequest;
    if (publishLock.current) throw new Error('Đang đăng yêu cầu, vui lòng chờ.');
    if (savingAddress) throw new Error('Vui lòng chờ lưu địa chỉ hoàn tất.');
    if (!pendingSubmission.current) {
      // Non-secret per-submission identifier; the server scopes it to the authenticated owner.
      const key = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
      const body = buildRequestBody(form, key, new Date(), !!editId);
      pendingSubmission.current = editId ? { ...body, expectedUpdatedAt: editVersion.current,
        items: body.items.map((item, i) => ({ ...item, ...(originalItemIds.current.has(form.items[i].id) ? { id: form.items[i].id } : {}) })),
      } : body;
    }
    publishLock.current = true;
    setPublishing(true); setRequestLocked(true);
    try {
      const result = await (editId ? updateRequest(editId, pendingSubmission.current as EditRequestBody, userId) : createAndPublishRequest(pendingSubmission.current, userId));
      if (alive.current) setPublishedRequest(result);
      return result;
    } catch (error) {
      // Definitive rejection permits editing. An uncertain response retries the exact snapshot/key.
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408) {
        pendingSubmission.current = null;
        if (alive.current) setRequestLocked(false);
        throw error;
      }
      throw new Error('Chưa xác nhận được kết quả lưu. Bấm thử lại để gửi lại cùng thay đổi.');
    } finally {
      publishLock.current = false;
      if (alive.current) setPublishing(false);
    }
  }

  const currentForm: RequestForm = {
    ...form, phone: form.phone ?? '', line1: form.line1 ?? '',
    province: form.province ?? null, ward: form.ward ?? null,
  };
  return <Context.Provider value={{
    form: currentForm, editId, editLoading, editError, reloadEdit: () => setEditAttempt(n => n + 1),
    patch: value => { if (!pendingSubmission.current) setForm(current => ({ ...current, ...value })); },
    reset: () => {
      if (publishLock.current) return;
      pendingSubmission.current = null;
      setPublishedRequest(null); setRequestLocked(false);
      setForm({ ...initialForm(), ...(preferred ? fromSavedAddress(preferred) : {}) });
    },
    addressLoading, addressError, savingAddress, publishing, requestLocked, publishedRequest, publishRequest,
    reloadAddress: () => setAttempt(n => n + 1), saveDeliveryAddress,
  }}>{children}</Context.Provider>;
}
export function useCreateRequest() {
  const value = useContext(Context);
  if (!value) throw new Error('CreateRequestProvider is required');
  return value;
}
