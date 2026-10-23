import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { DeliveryAddress, fromSavedAddress } from '@/features/addresses/addressForm';
import type { SavedAddress } from '@/features/addresses/api';
import { addressEntry } from '@/features/addresses/listCache';
import { useAddresses } from '@/features/addresses/useAddresses';
import { ApiError } from '@/lib/api';
import { buildRequestBody, createAndPublishRequest, CreateRequestBody, EditRequestBody, getEditableRequest, updateRequest } from './api';
import type { MealSuggestion, RecipeSnapshot } from '@/features/meals/api';
import type { OrderActionResult } from '@/features/orders/api';
import { useAuth } from '@/features/auth/AuthProvider';

export type RequestItem = { id: string; name: string; quantity: string; unit: string; note: string; allowSubstitution: boolean };
export type RequestForm = DeliveryAddress & { title: string; recipe?: RecipeSnapshot | null; originalDeliverBy?: string | null; items: RequestItem[]; day: 'today' | 'tomorrow'; time: string; budget: string; fee: string; payment: 'cash' | 'bank_transfer'; deliveryNote: string };
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
  startFromMeal: (meal: MealSuggestion) => void;
  addressLoading: boolean;
  addressError: string;
  reloadAddress: () => void;
  selectDeliveryAddress: (address: SavedAddress) => void;
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
  const addresses = useAddresses();
  const preferred = addresses.data?.find(a => a.isDefault) ?? addresses.data?.[0] ?? null;
  const addressLoading = addresses.data === undefined && addresses.fetching;
  const [selectionError, setSelectionError] = useState('');
  const addressError = selectionError || addresses.error;
  const initializedAddress = useRef(false);
  const alive = useRef(true);
  const publishLock = useRef(false);
  const pendingSubmission = useRef<CreateRequestBody | EditRequestBody | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [requestLocked, setRequestLocked] = useState(false);
  const [publishedRequest, setPublishedRequest] = useState<OrderActionResult | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => { if (userId) void addresses.refresh(); }, [userId, addresses.refresh]);
  useEffect(() => {
    if (!addresses.data || pendingSubmission.current) return;
    const rows = addresses.data;
    const shouldInitialize = !initializedAddress.current && !editId;
    if (form.savedAddress && !rows.some(a => a.id === form.savedAddress?.id)) setSelectionError('Địa chỉ đang chọn đã bị xóa. Vui lòng chọn lại.');
    setForm(current => {
      if (current.savedAddress) {
        const saved = rows.find(a => a.id === current.savedAddress?.id);
        if (!saved) {
          return { ...current, savedAddress: null, orderAddress: null, phone: '', line1: '', province: null, ward: null, coordinates: null };
        }
        return { ...current, ...fromSavedAddress(saved) };
      }
      if (shouldInitialize) {
        return preferred ? { ...current, ...fromSavedAddress(preferred), deliveryNote: preferred.deliveryNote ?? '' } : current;
      }
      return current;
    });
    initializedAddress.current = true;
  }, [addresses.data, editId]);

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

  function selectDeliveryAddress(address: SavedAddress) {
    if (!userId || pendingSubmission.current) throw new Error('Vui lòng xác nhận kết quả đăng yêu cầu trước khi đổi địa chỉ.');
    const saved = addressEntry(userId).snapshot.data?.find(a => a.id === address.id);
    if (!saved) throw new Error('Địa chỉ đã thay đổi. Vui lòng tải lại danh sách.');
    initializedAddress.current = true;
    setSelectionError('');
    setForm(current => ({ ...current, ...fromSavedAddress(saved), deliveryNote: saved.deliveryNote ?? '' }));
  }

  async function publishRequest(): Promise<OrderActionResult> {
    if (!userId) throw new Error('Bạn cần đăng nhập để đăng yêu cầu.');
    if (editId && (editLoading || editError || !editVersion.current)) throw new Error('Vui lòng tải lại đơn trước khi lưu.');
    if (publishedRequest) return publishedRequest;
    if (publishLock.current) throw new Error('Đang đăng yêu cầu, vui lòng chờ.');
    if (addresses.mutating) throw new Error('Vui lòng chờ lưu địa chỉ hoàn tất.');
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
      setPublishedRequest(null); setRequestLocked(false); setSelectionError('');
      initializedAddress.current = addresses.data !== undefined;
      setForm({ ...initialForm(), ...(preferred ? { ...fromSavedAddress(preferred), deliveryNote: preferred.deliveryNote ?? '' } : {}) });
    },
    startFromMeal: meal => {
      if (!alive.current || !userId) throw new Error('Tài khoản đã thay đổi. Vui lòng thử lại.');
      if (editId || addresses.mutating || publishLock.current || (pendingSubmission.current && !publishedRequest)) throw new Error('Vui lòng xử lý yêu cầu đang đăng trước khi chọn bữa mới.');
      pendingSubmission.current = null;
      setPublishedRequest(null); setRequestLocked(false);
      setForm(current => ({ ...current,
        title: meal.title, recipe: meal.recipe, budget: String(meal.suggestedGoodsAmount),
        items: meal.ingredients.map((i, index) => ({ id: `meal-${Date.now()}-${index}`, name: i.name, quantity: String(i.quantity), unit: i.unit, note: i.note ?? '', allowSubstitution: false })),
      }));
    },
    addressLoading, addressError, publishing, requestLocked, publishedRequest, publishRequest,
    reloadAddress: () => { setSelectionError(''); void addresses.refresh(true); }, selectDeliveryAddress,
  }}>{children}</Context.Provider>;
}
export function useCreateRequest() {
  const value = useContext(Context);
  if (!value) throw new Error('CreateRequestProvider is required');
  return value;
}
