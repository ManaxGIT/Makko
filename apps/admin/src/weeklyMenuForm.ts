import type { MenuIngredient } from './api';
export type WeekMenuBody = { weekStart: string; ingredients: MenuIngredient[] };
export type PublishedWeek = WeekMenuBody & { id: string; deliveryDeadline: string; publishedAt: string };
export function emptyMenu(): MenuIngredient[] { return [{ name: '', quantity: '' }]; }
export function weekSchedule(weekStart: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;
  const calendar = new Date(`${weekStart}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== weekStart) return null;
  const start = Date.parse(`${weekStart}T00:00:00+07:00`);
  return { monday: calendar.getUTCDay() === 1, deadline: start - 1, publishBy: start - 1 - 10 * 86400000, registerBy: start - 1 - 7 * 86400000 };
}
export function validateMenu(weekStart: string, ingredients: MenuIngredient[], now = Date.now()): string {
  const schedule = weekSchedule(weekStart);
  if (!schedule) return 'Chọn ngày bắt đầu tuần.';
  if (!schedule.monday) return 'Tuần sử dụng phải bắt đầu vào thứ Hai.';
  if (now >= schedule.publishBy) return 'Tuần này đã qua hạn công bố. Chọn tuần khác, cách hạn giao Chủ nhật ít nhất 10 ngày.';
  if (!ingredients.length || ingredients.length > 350) return 'Nhập từ 1 đến 350 nguyên liệu cho gói.';
  if (ingredients.some(v => !v.name.trim() || !v.quantity.trim())) return 'Nhập đủ tên và định lượng cho từng nguyên liệu.';
  if (ingredients.some(v => v.name.trim().length > 160 || v.quantity.trim().length > 60)) return 'Tên nguyên liệu tối đa 160 ký tự, định lượng tối đa 60 ký tự.';
  return '';
}
export function menuBody(weekStart: string, ingredients: MenuIngredient[]): WeekMenuBody {
  const totals = totalIngredients(ingredients);
  return { weekStart, ingredients: [...totals.grouped, ...totals.separate].map(v => ({ name: v.name.trim(), quantity: v.quantity.trim() })) };
}
export function sameMenu(left: WeekMenuBody, right: WeekMenuBody) {
  return JSON.stringify(menuBody(left.weekStart, left.ingredients)) === JSON.stringify(menuBody(right.weekStart, right.ingredients));
}
export function menuDate(time: number) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(time);
}

/** Only explicit units are additive. Free-form quantities stay as separate lines. */
export function totalIngredients(ingredients: MenuIngredient[]) {
  const units: Record<string, [string, number]> = { g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000], lít: ['ml', 1000], quả: ['quả', 1], cái: ['cái', 1], bó: ['bó', 1], củ: ['củ', 1], con: ['con', 1], hộp: ['hộp', 1], gói: ['gói', 1] };
  const groups = new Map<string, { name: string; unit: string; amount: number;  }>();
  const separate: { name: string; quantity: string;  }[] = [];
  for (const ingredient of ingredients) {
    const name = ingredient.name.normalize('NFC').trim().replace(/\s+/g, ' '), quantity = ingredient.quantity.trim();
    if (!name && !quantity) continue;
    const match = /^(\d+(?:[.,]\d{1,3})?)\s*([^\d\s]+)$/u.exec(quantity.toLocaleLowerCase('vi'));
    const unit = match && units[match[2]];
    const amount = match && unit ? Number(match[1].replace(',', '.')) * unit[1] : NaN;
    if (!name || !unit || !Number.isFinite(amount) || amount <= 0 || amount > 1e9) { separate.push({ name: name || 'Chưa nhập tên', quantity: quantity || 'Chưa nhập định lượng' }); continue; }
    const key = JSON.stringify([name.toLocaleLowerCase('vi'), unit[0]]), existing = groups.get(key);
    if (existing) { existing.amount += amount; }
    else groups.set(key, { name, unit: unit[0], amount });
  }
  const formatter = new Intl.NumberFormat('vi-VN', { useGrouping: false, maximumFractionDigits: 6 });
  return { grouped: Array.from(groups.values(), row => {
    const large = (row.unit === 'g' || row.unit === 'ml') && row.amount >= 1000;
    return { name: row.name, quantity: `${formatter.format(row.amount / (large ? 1000 : 1))} ${large ? (row.unit === 'g' ? 'kg' : 'l') : row.unit}` };
  }), separate };
}
