import { useEffect, useRef, useState, type FormEvent } from 'react';
import { WeeklyPackageList } from './WeeklyPackageList';
import { api, ApiError, type MenuIngredient } from './api';
import { emptyMenu, menuBody, menuDate, sameMenu, totalIngredients as aggregateIngredients, validateMenu, weekSchedule, type PublishedWeek, type WeekMenuBody } from './weeklyMenuForm';

export function WeeklyMenuEditor({ userId, onDenied }: { userId: string; onDenied: (message: string) => void }) {
  const [weekStart, setWeekStart] = useState(''), [menu, setMenu] = useState<MenuIngredient[]>(emptyMenu), [step, setStep] = useState<'edit' | 'review'>('edit');
  const [error, setError] = useState(''), [publishedId, setPublishedId] = useState(''), [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null), active = useRef(true), writing = useRef(false), reviewHeading = useRef<HTMLHeadingElement>(null), errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => { if (step === 'review') reviewHeading.current?.focus(); }, [step]);
  const schedule = weekSchedule(weekStart), totalIngredients = menu.filter(i => i.name.trim() && i.quantity.trim()).length;
  function report(message: string) { setError(message); requestAnimationFrame(() => errorBox.current?.focus()); }
  function review(event: FormEvent) { event.preventDefault(); const failure = validateMenu(weekStart, menu); if (failure) { report(failure); return; } setError(''); setStep('review'); }
  async function reconcile(body: WeekMenuBody, signal: AbortSignal) {
    const weeks = await api<PublishedWeek[]>('/weekly-food/weeks', signal, undefined, userId);
    const existing = weeks.find(w => w.weekStart === body.weekStart);
    if (existing && sameMenu(existing, body)) { if (active.current) { setPublishedId(existing.id); setError(''); } return true; }
    return false;
  }
  async function publish() {
    if (writing.current || publishedId) return;
    const failure = validateMenu(weekStart, menu);
    if (failure) { report(failure); return; }
    const body = menuBody(weekStart, menu), abort = new AbortController();
    controller.current = abort; writing.current = true; setBusy(true); setError('');
    try {
      const result = await api<{ id: string }>('/admin/weekly-weeks', abort.signal, body, userId);
      if (active.current) setPublishedId(result.id);
    } catch (failure) {
      if (!active.current || abort.signal.aborted) return;
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) { onDenied(failure.message); return; }
      // A lost response can still mean the unique week was committed. Read it
      // before presenting a retry; never publish a demonstration menu for QA.
      if (!(failure instanceof ApiError) || failure.status === 409 || failure.status >= 500) {
        try { if (await reconcile(body, abort.signal)) return; }
        catch (readError) { if (readError instanceof ApiError && [401,403].includes(readError.status)) { onDenied(readError.message); return; } }
      }
      if (active.current && !abort.signal.aborted) report(failure instanceof ApiError ? failure.message : 'Chưa xác nhận được kết quả công bố. Kiểm tra kết nối rồi thử lại với cùng nguyên liệu.');
    } finally { writing.current = false; if (active.current) setBusy(false); }
  }
  function reset() { setWeekStart(''); setMenu(emptyMenu()); setPublishedId(''); setError(''); setStep('edit'); }
  const totals = aggregateIngredients(menu);
  const preview = <section className="panel ingredient-totals" aria-label="Tổng nguyên liệu trong gói"><h2>Tổng nguyên liệu trong gói</h2><p className="menu-help">Định lượng chuẩn cho 1 người, 1 bữa/ngày trong 7 ngày. Cộng các dòng cùng tên và đơn vị tương thích; định lượng chưa rõ được giữ riêng.</p>{!totals.grouped.length && !totals.separate.length && <p className="muted">Nhập nguyên liệu để xem tổng.</p>}{[...totals.grouped, ...totals.separate].map((v, i) => <div className="row" key={i}><b>{v.name}</b><span>{v.quantity}</span></div>)}</section>;
  return <section className="weekly-menu" aria-label="Nguyên liệu trong gói">
    <WeeklyPackageList userId={userId} onDenied={onDenied} revision={publishedId}/><div id="new-week-editor" className="menu-step"><span className={step === 'edit' ? '' : 'inactive'}>01 · Nhập nguyên liệu</span><span className={step === 'review' ? '' : 'inactive'}>02 · Xem lại & công bố</span></div>
    {error && <div ref={errorBox} tabIndex={-1} className="error-strip" role="alert">{error}</div>}
    {publishedId && <div className="menu-success" role="status"><span className="tag green">Đã công bố</span><h2>Gói nguyên liệu đã sẵn sàng trên app</h2><p>Tuần bắt đầu {menuDate(Date.parse(weekStart + 'T00:00:00+07:00'))}. Khách có thể làm mới mục gói tuần để xem nguyên liệu và đăng ký.</p><button onClick={reset}>Tạo gói tuần khác</button></div>}
    {step === 'edit' ? <form onSubmit={review}><fieldset disabled={busy} className="menu-fieldset">
      <section className="panel schedule"><label className="menu-label" htmlFor="menu-week">Tuần bắt đầu<input id="menu-week" type="date" required value={weekStart} onChange={e => { setWeekStart(e.target.value); setError(''); }} /><span className="menu-help">Chọn ngày thứ Hai.</span></label><p className="muted">Công bố ít nhất 10 ngày trước hạn giao Chủ nhật.</p></section>
      <div className="week-grid"><div><section className="panel menu-day"><h2>Danh sách nguyên liệu</h2><p className="menu-help">Định lượng chuẩn: 1 người · 1 bữa/ngày · 7 ngày. Nhập dạng số và đơn vị, ví dụ 300 g hoặc 2 quả. App tự nhân theo số người và nhân đôi khi chọn trưa và tối.</p>{menu.map((ingredient, i) => <div key={i} className="ingredient-row"><input required maxLength={160} aria-label={`Nguyên liệu ${i+1}`} placeholder="Tên nguyên liệu" value={ingredient.name} onChange={e => setMenu(rows => rows.map((v,j) => j === i ? {...v,name:e.target.value} : v))}/><input required maxLength={60} aria-label={`Định lượng ${i+1}`} placeholder="Ví dụ: 300 g" value={ingredient.quantity} onChange={e => setMenu(rows => rows.map((v,j) => j === i ? {...v,quantity:e.target.value} : v))}/><button type="button" disabled={menu.length === 1} aria-label={`Bỏ nguyên liệu ${i+1}`} onClick={() => setMenu(rows => rows.filter((_,j) => j !== i))}>×</button></div>)}<button type="button" className="menu-add" disabled={menu.length >= 350} onClick={() => setMenu(rows => [...rows,{name:'',quantity:''}])}>＋ Thêm nguyên liệu</button></section>{preview}</div><Summary schedule={schedule} totalIngredients={totalIngredients}><button className="primary" type="submit">Xem lại nguyên liệu →</button></Summary></div>
    </fieldset></form> : <div className="week-grid"><div><h2 ref={reviewHeading} tabIndex={-1}>Xem lại nguyên liệu trong gói</h2><p className="muted">Kiểm tra tên và định lượng trước khi công bố. Hiện chưa hỗ trợ chỉnh sửa gói đã công bố.</p>{preview}</div><Summary schedule={schedule} totalIngredients={totalIngredients}>{!publishedId && <><button className="primary" type="button" disabled={busy} onClick={() => void publish()}>{busy ? 'Đang công bố…' : 'Công bố gói nguyên liệu'}</button><button className="menu-edit-back" type="button" disabled={busy} onClick={() => { setStep('edit'); setError(''); }}>Quay lại chỉnh sửa</button></>}</Summary></div>}
  </section>;
}
function Summary({ schedule, totalIngredients, children }: { schedule: ReturnType<typeof weekSchedule>; totalIngredients: number; children: React.ReactNode }) {
  return <section className="panel menu-summary"><div className="eyebrow">TÓM TẮT GÓI</div><h3 style={{marginTop:10}}>Đủ nguyên liệu cho cả tuần</h3><div className="row"><span>Nguyên liệu đã nhập</span><b>{totalIngredients} dòng</b></div><div className="row"><span>Giao chậm nhất</span><b>{schedule?.monday ? `Chủ nhật, ${menuDate(schedule.deadline)}` : 'Chọn tuần bắt đầu'}</b></div>{schedule?.monday && <><div className="row"><span>Hạn công bố</span><b>{menuDate(schedule.publishBy)}</b></div><div className="row"><span>Hạn đăng ký của khách</span><b>{menuDate(schedule.registerBy)}</b></div></>}<p className="menu-help">Mức chuẩn: 1 người · 1 bữa/ngày · 7 ngày. Chỉ trưa và chỉ tối dùng cùng định lượng. Chọn cả hai bữa sẽ nhân đôi, sau đó nhân theo số người.</p>{children}</section>;
}
