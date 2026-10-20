import { createContext, PropsWithChildren, useContext, useState } from 'react';

export type RequestItem = { id: string; name: string; quantity: string; unit: string; note: string; allowSubstitution: boolean };
export type RequestForm = { items: RequestItem[]; recipient: string; phone: string; address: string; day: 'today' | 'tomorrow'; time: string; budget: string; fee: string; payment: 'cash' | 'bank_transfer'; deliveryNote: string };
// Figma's sample data is for this explicitly labelled UI preview only.
const initialForm = (): RequestForm => ({
  items: [
    { id: '1', name: 'Thịt heo nạc vai', quantity: '0,5', unit: 'kg', note: 'Chọn phần ít mỡ', allowSubstitution: false },
    { id: '2', name: 'Rau muống', quantity: '1', unit: 'bó', note: 'Rau non, ít cọng già', allowSubstitution: true },
    { id: '3', name: 'Trứng gà', quantity: '6', unit: 'quả', note: '', allowSubstitution: false },
  ], recipient: '', phone: '', address: '', day: 'today', time: '18:00', budget: '', fee: '25000', payment: 'cash', deliveryNote: '',
});
type FormContext = { form: RequestForm; patch: (value: Partial<RequestForm>) => void; reset: () => void };
const Context = createContext<FormContext | null>(null);
export function CreateRequestProvider({ children }: PropsWithChildren) {
  const [form, setForm] = useState(initialForm);
  return <Context.Provider value={{ form, patch: value => setForm(current => ({ ...current, ...value })), reset: () => setForm({ ...initialForm(), items: [], recipient: '', phone: '', address: '' }) }}>{children}</Context.Provider>;
}
export function useCreateRequest() {
  const value = useContext(Context);
  if (!value) throw new Error('CreateRequestProvider is required');
  return value;
}
