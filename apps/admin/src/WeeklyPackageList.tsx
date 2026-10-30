import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { Overlay } from './Overlay';
import { menuDate, weekSchedule, type PublishedWeek } from './weeklyMenuForm';

type Package = PublishedWeek & { orderCount: number };
type PackageList = { items: Package[]; total: number };
const pageSize = 25;
function range(week: PublishedWeek) {
  const start = Date.parse(week.weekStart + 'T00:00:00+07:00');
  return `${menuDate(start)} – ${menuDate(start + 6 * 86400000)}`;
}

export function WeeklyPackageList({ userId, onDenied, revision }: { userId: string; onDenied: (message: string) => void; revision: string }) {
  const [data, setData] = useState<(PackageList & { page: number })>(), [page, setPage] = useState(0), [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<Package>(), [deleting, setDeleting] = useState<Package>(), [busy, setBusy] = useState(false);
  const readAbort = useRef<AbortController | null>(null), writeAbort = useRef<AbortController | null>(null), generation = useRef(0), writing = useRef(false), active = useRef(true);
  const onDeniedRef = useRef(onDenied); onDeniedRef.current = onDenied;
  useEffect(() => { active.current = true; return () => { active.current = false; readAbort.current?.abort(); writeAbort.current?.abort(); generation.current++; }; }, []);
  useEffect(() => {
    const controller = new AbortController(), version = ++generation.current;
    readAbort.current?.abort(); readAbort.current = controller; setLoading(true); setError('');
    api<PackageList>(`/admin/weekly-weeks?page_offset=${page * pageSize}&page_limit=${pageSize}`, controller.signal, undefined, userId).then(result => {
      if (!controller.signal.aborted && version === generation.current) setData({ ...result, page });
    }).catch(failure => {
      if (controller.signal.aborted || version !== generation.current) return;
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) onDeniedRef.current(failure.message);
      else setError(failure instanceof ApiError ? failure.message : 'Chưa tải được danh sách gói. Vui lòng thử lại.');
    }).finally(() => { if (!controller.signal.aborted && version === generation.current) setLoading(false); });
    return () => controller.abort();
  }, [userId, page, refresh, revision]);
  function removeLocally(id: string) {
    // Discard any older read before applying the confirmed deletion.
    generation.current++; readAbort.current?.abort(); setLoading(false);
    setData(previous => previous && ({ ...previous, items: previous.items.filter(w => w.id !== id), total: Math.max(0, previous.total - 1) }));
    setDetail(previous => previous?.id === id ? undefined : previous); setDeleting(undefined);
    setNotice('Gói đã được xóa khỏi danh sách đăng ký.'); setError('');
    if (data?.items.length === 1 && page > 0) setPage(page - 1);
  }
  async function confirmDelete() {
    if (!deleting || writing.current || deleting.orderCount > 0) return;
    const target = deleting, controller = new AbortController();
    writing.current = true; writeAbort.current = controller; setBusy(true); setError('');
    try {
      await api(`/admin/weekly-weeks/${target.id}/delete`, controller.signal, {}, userId);
      if (active.current && !controller.signal.aborted) removeLocally(target.id);
    } catch (failure) {
      if (!active.current || controller.signal.aborted) return;
      if (failure instanceof ApiError && [401, 403].includes(failure.status)) onDeniedRef.current(failure.message);
      else if (failure instanceof ApiError && failure.status === 404) removeLocally(target.id);
      else {
        setError(failure instanceof ApiError ? failure.message : 'Chưa xác nhận được kết quả xóa. Làm mới danh sách để kiểm tra trước khi thử lại.');
        setDeleting(undefined);
        if (failure instanceof ApiError && failure.status === 409) { setNotice(failure.message); setRefresh(v => v + 1); }
      }
    } finally { writing.current = false; if (active.current) setBusy(false); }
  }
  return <section className="package-list" aria-label="Các gói nguyên liệu đã công bố">
    {error && <div className="error-strip" role="alert">{error} <button disabled={busy || loading} onClick={() => setRefresh(v => v + 1)}>Thử lại</button></div>}
    {notice && <p role="status">{notice} <button className="quiet" onClick={() => setNotice('')}>Đóng</button></p>}
    <section className="panel" aria-busy={loading}>
      <div className="panel-head"><h3>Gói đã công bố <span className="count">{data?.total ?? '—'}</span></h3><div className="package-actions"><button disabled={loading || busy} onClick={() => setRefresh(v => v + 1)}>Làm mới</button><button className="primary" onClick={() => document.getElementById('new-week-editor')?.scrollIntoView({ behavior: 'smooth' })}>Tạo gói tuần mới</button></div></div>
      <div className="table-scroll"><table><thead><tr>{['TUẦN SỬ DỤNG', 'GIAO CHẬM NHẤT', 'NGUYÊN LIỆU', 'ĐƠN ĐĂNG KÝ', 'TRẠNG THÁI', ''].map((label, i) => <th key={i}>{label}</th>)}</tr></thead><tbody>{data?.items.map(week => {
        const schedule = weekSchedule(week.weekStart), open = !!schedule && Date.now() <= schedule.registerBy;
        return <tr key={week.id}><td><b>{range(week)}</b><small>Công bố {week.publishedAt ? menuDate(Date.parse(week.publishedAt)) : '—'}</small></td><td>{menuDate(Date.parse(week.deliveryDeadline))}<small>Chủ nhật hạn chót</small></td><td>{week.ingredients.length} nguyên liệu</td><td>{week.orderCount} đơn<small>Kể cả đơn đã hủy</small></td><td><span className={`tag ${open ? 'warm' : ''}`}>{open ? 'Đang mở đăng ký' : 'Đã hết hạn'}</span><small>Hạn đăng ký {schedule ? menuDate(schedule.registerBy) : '—'}</small></td><td><div className="package-actions"><button onClick={() => setDetail(week)}>Xem nguyên liệu</button><button className="danger" disabled={busy || week.orderCount > 0} title={week.orderCount > 0 ? 'Gói đã có đơn đăng ký nên không thể xóa.' : 'Xóa gói chưa có đơn đăng ký'} onClick={() => { setDeleting(week); setError(''); }}>Xóa gói</button></div></td></tr>;
      })}</tbody></table></div>
      {!data && loading && <p className="empty">Đang tải các gói nguyên liệu…</p>}
      {data?.items.length === 0 && <p className="empty">Chưa có gói nguyên liệu trong trang này.</p>}
      <div className="table-foot"><span>{data ? `${data.total === 0 || data.items.length === 0 ? 0 : data.page * pageSize + 1}–${data.items.length ? data.page * pageSize + data.items.length : 0} / ${data.total} gói` : 'Chưa có dữ liệu'}</span><div className="pages"><button disabled={page === 0 || loading || busy} onClick={() => setPage(v => v - 1)}>Trước</button><span>Trang {data ? data.page + 1 : page + 1}</span><button disabled={!data || (page + 1) * pageSize >= data.total || loading || busy} onClick={() => setPage(v => v + 1)}>Sau</button></div></div>
    </section>
    <p className="menu-help">Chỉ xóa được gói chưa từng có đơn đăng ký. Gói đã có đơn được giữ lại để bảo toàn lịch sử.</p>
    {detail && <Overlay label="Nguyên liệu của gói đã công bố" onClose={() => setDetail(undefined)}><header className="detail-top"><div><div className="eyebrow">GÓI NGUYÊN LIỆU TUẦN</div><h2>{range(detail)}</h2></div><button onClick={() => setDetail(undefined)}>Đóng</button></header><section className="ingredient-totals"><p className="muted">Định lượng chuẩn cho 1 người, 1 bữa/ngày trong 7 ngày.</p>{detail.ingredients.map((ingredient, i) => <div className="row" key={i}><span>{ingredient.name}</span><b>{ingredient.quantity}</b></div>)}</section></Overlay>}
    {deleting && <Overlay label="Xác nhận xóa gói nguyên liệu" onClose={() => { if (!writing.current) setDeleting(undefined); }}><div className="package-confirm"><h2>Xóa gói tuần này?</h2><p><b>{range(deleting)}</b></p><p>Gói sẽ bị xóa khỏi danh sách đăng ký. Thao tác này không thể hoàn tác.</p><p className="muted">Hệ thống sẽ kiểm tra lại và chặn xóa nếu đã có đơn đăng ký.</p><div className="package-actions"><button disabled={busy} onClick={() => setDeleting(undefined)}>Giữ lại</button><button className="danger" disabled={busy} onClick={() => void confirmDelete()}>{busy ? 'Đang xóa…' : 'Xóa gói'}</button></div></div></Overlay>}
  </section>;
}
