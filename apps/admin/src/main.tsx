import { StrictMode, useEffect, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';
import { api, ApiError, configured, supabase, type Detail, type Order, type OrderList } from './api';
import './styles.css';
import { Overlay } from './Overlay';
import { WeeklyMenuEditor } from './WeeklyMenuEditor';
const labels: Record<string, string> = { draft: 'Bản nháp', registered: 'Còn hạn hủy', open: 'Chờ người nhận', accepted: 'Đã có người nhận', shopping: 'Đang mua hàng', delivering: 'Đang giao', delivered: 'Chờ khách xác nhận', completed: 'Hoàn tất', cancelled: 'Đã hủy', disputed: 'Có sự cố' };
const money = (n: number | null) => n === null ? 'Chưa có' : n.toLocaleString('vi-VN') + 'đ';
const date = (s: string | null) => s ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(s)) : 'Chưa có';
function Badge({ order: o }: {
    order: Order;
}) { return <span className={`tag ${o.status === 'completed' ? 'green' : ['accepted', 'shopping'].includes(o.status) ? 'warm' : o.status === 'delivered' ? 'coral' : ''}`}>{o.type === 'weekly' && o.status === 'accepted' ? 'Chờ bàn giao' : labels[o.status] || o.status}</span>; }
function Login({ denied }: {
    denied: string;
}) { const [error, setError] = useState(''), [busy, setBusy] = useState(false); async function login(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const data = new FormData(e.currentTarget); setBusy(true); setError(''); const result = await supabase.auth.signInWithPassword({ email: String(data.get('email')).trim(), password: String(data.get('password')) }); if (result.error)
    setError('Không đăng nhập được. Kiểm tra email, mật khẩu và thử lại.'); setBusy(false); } return <section className="login panel"><div className="logo">makko<span>.</span></div><div className="eyebrow">KHÔNG GIAN QUẢN LÝ</div><h1>Chào bạn trở lại.</h1><p className="muted">Đăng nhập bằng tài khoản Makko được cấp quyền quản trị.</p>{denied ? <><p className="error" role="alert">{denied}</p><button onClick={() => void supabase.auth.signOut({ scope: 'local' })}>Đăng xuất</button><button onClick={() => location.reload()}>Kiểm tra lại quyền</button></> : <form onSubmit={login}><label>Email<input name="email" type="email" autoComplete="username" required disabled={busy}/></label><label>Mật khẩu<input name="password" type="password" autoComplete="current-password" required disabled={busy}/></label>{error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button></form>}</section>; }
function App() {
    const [session, setSession] = useState<Session | null>(null), [boot, setBoot] = useState(true), [allowed, setAllowed] = useState(false), [denied, setDenied] = useState('');
    const [retry, setRetry] = useState(0);
    useEffect(() => { let active = true, revision = 0; const { data } = supabase.auth.onAuthStateChange((_event, s) => { revision++; if (active) {
        setSession(s);
        setBoot(false);
    } }); const initialRevision = revision; supabase.auth.getSession().then(({ data }) => { if (active && revision === initialRevision) {
        setSession(data.session);
        setBoot(false);
    } }); return () => { active = false; data.subscription.unsubscribe(); }; }, []);
    const userId = session?.user.id;
    useEffect(() => { setAllowed(false); setDenied(''); if (!userId)
        return; const controller = new AbortController(); api('/admin/me', controller.signal).then(() => setAllowed(true)).catch(e => { if (!controller.signal.aborted)
        setDenied(e.message); }); return () => controller.abort(); }, [userId, retry]);
    if (!configured)
        return <section className="login panel"><h1>Chưa cấu hình web quản trị</h1><p>Thiết lập các biến trong apps/admin/.env theo README rồi khởi động lại web.</p></section>;
    if (boot)
        return <section className="login">Đang mở phiên đăng nhập…</section>;
    if (!session)
        return <Login denied=""/>;
    if (denied)
        return <Login denied={denied}/>;
    if (!allowed)
        return <section className="login">Đang kiểm tra quyền quản trị… <button onClick={() => setRetry(x => x + 1)}>Thử lại</button></section>;
    return <Dashboard key={session.user.id} session={session} onDenied={setDenied}/>;
}
function Dashboard({ session, onDenied }: {
    session: Session;
    onDenied: (v: string) => void;
}) {
    const [view, setView] = useState('all'), [type, setType] = useState('all'), [status, setStatus] = useState('all'), [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(0), [refresh, setRefresh] = useState(0);
    const [data, setData] = useState<OrderList | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [detail, setDetail] = useState<Detail | null>(null), [detailError, setDetailError] = useState(''), [detailLoading, setDetailLoading] = useState(false), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [notice, setNotice] = useState('');
    const detailController = useRef<AbortController | null>(null), live = useRef(true), actionController = useRef<AbortController | null>(null);
    useEffect(() => { live.current = true; return () => { live.current = false; detailController.current?.abort(); actionController.current?.abort(); }; }, []);
    useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);
    function handleError(e: unknown) { const err = e as Error; if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setData(null);
        setDetail(null);
        onDenied(err.message);
    } return err.message || 'Không tải được dữ liệu.'; }
    useEffect(() => { if (view === 'menus') return; const controller = new AbortController(); setLoading(true); setError(''); const params = new URLSearchParams({ order_type: type, status_filter: status, search_query: query, work_queue: view, page_offset: String(page * 25), page_limit: '25' }); api<OrderList>(`/admin/orders?${params}`, controller.signal).then(result => { if (!controller.signal.aborted) {
        setData(result);
        if (result.total > 0 && page * 25 >= result.total)
            setPage(Math.floor((result.total - 1) / 25));
    } }).catch(e => { if (!controller.signal.aborted)
        setError(handleError(e)); }).finally(() => { if (!controller.signal.aborted)
        setLoading(false); }); return () => controller.abort(); }, [type, status, query, view, page, refresh]);
    async function open(o: Order) { detailController.current?.abort(); const controller = new AbortController(); detailController.current = controller; setDetail(null); setDetailLoading(true); setDetailError(''); try {
        const result = await api<Detail>(`/admin/orders/${o.type}/${o.id}`, controller.signal);
        if (!controller.signal.aborted)
            setDetail(result);
    }
    catch (e) {
        if (!controller.signal.aborted)
            setDetailError(handleError(e));
    }
    finally {
        if (!controller.signal.aborted)
            setDetailLoading(false);
    } }
    function close() { if (busy)
        return; detailController.current?.abort(); setDetail(null); setDetailError(''); setDetailLoading(false); setConfirm(false); }
    async function act() { if (!detail || busy)
        return; setBusy(true); setDetailError(''); const controller = new AbortController(); actionController.current = controller; try {
        await api(`/admin/weekly-orders/${detail.id}/${detail.status === 'accepted' ? 'handover' : 'pay-wage'}`, controller.signal, {});
        if (!live.current)
            return;
        setConfirm(false);
        setNotice('Đã ghi nhận thành công.');
        setRefresh(x => x + 1);
        const next = await api<Detail>(`/admin/orders/weekly/${detail.id}`, controller.signal);
        if (live.current)
            setDetail(next);
    }
    catch (e) {
        if (!controller.signal.aborted) {
            setConfirm(false);
            setDetailError(handleError(e));
            setRefresh(x => x + 1);
        }
    }
    finally {
        if (live.current)
            setBusy(false);
    } }
    function changeView(v: string) { setView(v); setType('all'); setStatus('all'); setSearch(''); setQuery(''); setPage(0); }
    const title = { all: 'Quản lý đơn hàng', handover: 'Bàn giao gói tuần', wages: 'Trả công người giao', menus: 'Nguyên liệu trong gói' }[view];
    const d = detail, canHand = d?.type === 'weekly' && d.status === 'accepted', canPay = d?.type === 'weekly' && d.status === 'completed' && !d.wagePaidAt;
    return <><aside><div className="logo">makko<span>.</span></div><p className="eyebrow">KHÔNG GIAN QUẢN LÝ</p><nav aria-label="Quản lý">{[['all', 'Tất cả đơn hàng'], ['handover', 'Bàn giao gói tuần'], ['wages', 'Trả công người giao'], ['menus', 'Nguyên liệu trong gói']].map(([v, t]) => <button key={v} className={view === v ? 'active' : ''} onClick={() => changeView(v)}>{t}</button>)}</nav><footer><b>Makko · Đà Nẵng</b><p>Vận hành tại điểm nhận hàng</p></footer></aside><main><header className="topbar"><span>Vận hành / {title}</span><div className="account"><span>{session.user.email}</span><span className="avatar">M</span><button onClick={() => void supabase.auth.signOut({ scope: 'local' })}>Đăng xuất</button></div></header><section className="heading"><div><div className="eyebrow">MỖI ĐƠN HÀNG, MỘT BỮA CƠM NHÀ</div><h1>{title}</h1><p className="muted">{view === 'menus' ? 'Quản lý các gói đã công bố và chuẩn bị gói tuần mới.' : view === 'all' ? 'Theo dõi đơn nhờ đi chợ và gói nguyên liệu, cùng một nơi.' : view === 'handover' ? 'Các gói đã có người nhận, đang chờ thu tiền ứng và bàn giao.' : 'Các gói khách đã nhận, đang chờ Makko trả tiền công.'}</p></div><button hidden={view === 'menus'} onClick={() => setRefresh(x => x + 1)} disabled={loading}>{loading ? 'Đang cập nhật…' : 'Làm mới'}</button></section><div hidden={view !== 'menus'}><WeeklyMenuEditor userId={session.user.id} onDenied={onDenied}/></div><div hidden={view === 'menus'}>{error && <div className="error-strip" role="alert">{error} <button onClick={() => setRefresh(x => x + 1)}>Thử lại</button></div>}{notice && <p role="status">{notice} <button className="quiet" onClick={() => setNotice('')}>Đóng</button></p>}<section className="stats" aria-label="Thống kê">{[['Tổng đơn', data?.stats.total, 'Gói tuần & nhờ đi chợ'], ['Chờ bàn giao', data?.stats.handover, 'Đã có người nhận gói'], ['Đang giao', data?.stats.delivering, 'Chờ xác nhận giao nhận'], ['Chờ trả công', data?.stats.wages, 'Gói tuần đã hoàn tất']].map(([t, n, h]) => <div className="stat" key={String(t)}><span>{t}</span><strong>{n === undefined ? '—' : n}</strong><small>{h}</small></div>)}</section><section className="panel" aria-busy={loading}><div className="panel-head"><h3>Danh sách đơn <span className="count">{data?.total ?? '—'}</span></h3><small>Dữ liệu từ Makko</small></div>{view === 'all' && <div className="tabs" role="group" aria-label="Loại đơn">{[['all', 'Tất cả'], ['weekly', 'Gói nguyên liệu tuần'], ['errand', 'Nhờ đi chợ']].map(([v, t]) => <button key={v} aria-pressed={type === v} className={type === v ? 'active' : ''} onClick={() => { setType(v); setPage(0); }}>{t}</button>)}</div>}<div className="filters"><input aria-label="Tìm đơn hàng" placeholder="Tìm mã đơn, khách hàng, người đi giúp…" value={search} maxLength={120} onChange={e => setSearch(e.target.value)}/><select aria-label="Trạng thái" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="all">Tất cả trạng thái</option>{Object.entries(labels).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div><div className="table-scroll"><table><thead><tr>{['ĐƠN HÀNG', 'KHÁCH HÀNG', 'NGƯỜI ĐI GIÚP', 'THỜI GIAN GIAO', 'GIÁ TRỊ', 'TRẠNG THÁI', ''].map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{data?.items.map(o => <tr key={o.type + o.id}><td><button className="order-link" onClick={() => void open(o)}>{o.id.slice(0, 8).toUpperCase()}</button><small>{o.type === 'weekly' ? 'Gói nguyên liệu tuần' : 'Nhờ đi chợ'}</small></td><td><b>{o.customerName}</b></td><td>{o.shopperName || 'Chưa có người nhận'}</td><td>{date(o.deliveryDeadline)}<small>{o.type === 'weekly' ? 'Chủ nhật hạn chót' : 'Hạn giao khách yêu cầu'}</small></td><td><b>{money(o.price)}</b><small>{o.type === 'weekly' ? 'Đã gồm giao hàng' : '+ ' + money(o.fee) + ' tiền công'}</small></td><td><Badge order={o}/>{o.type === 'weekly' && o.status === 'completed' && <small>{o.wagePaidAt ? 'Đã trả công' : 'Chưa trả công'}</small>}</td><td><button onClick={() => void open(o)} aria-label={`Chi tiết ${o.id.slice(0, 8)}`}>Chi tiết →</button></td></tr>)}</tbody></table></div>{!data && loading && <p className="empty">Đang tải đơn hàng…</p>}{data?.items.length === 0 && <p className="empty">Không có đơn phù hợp với bộ lọc hiện tại.</p>}<div className="table-foot"><span>{data ? `${data.total === 0 ? 0 : page * 25 + 1}–${Math.min((page + 1) * 25, data.total)} / ${data.total} đơn` : 'Chưa có dữ liệu'}</span><div className="pages"><button disabled={page === 0 || loading} onClick={() => setPage(x => x - 1)}>Trước</button><span>Trang {page + 1}</span><button disabled={!data || (page + 1) * 25 >= data.total || loading} onClick={() => setPage(x => x + 1)}>Sau</button></div></div></section></div></main>{(d || detailLoading || detailError) && <Overlay label="Chi tiết đơn hàng" onClose={close}><header className="detail-top"><div><div className="eyebrow">{d?.type === 'weekly' ? 'GÓI NGUYÊN LIỆU TUẦN' : 'ĐƠN HÀNG'}</div><h2>Đơn {d?.id.slice(0, 8).toUpperCase()}</h2>{d && <Badge order={d}/>}</div><button className="close" aria-label="Đóng chi tiết" disabled={busy} onClick={close}>×</button></header>{detailError && <p className="error-strip" role="alert">{detailError}</p>}{detailLoading ? <p className="empty">Đang tải chi tiết…</p> : d && <><div className="detail-body"><div><div className="box"><h3>{d.title}</h3><div className="row"><span>{d.type === 'weekly' ? 'Giá gói' : 'Tiền hàng thỏa thuận'}</span><b>{money(d.price)}</b></div><div className="row"><span>{d.type === 'weekly' ? 'Tiền công Makko trả riêng' : 'Tiền công riêng'}</span><b>{money(d.fee)}</b></div>{d.type === 'weekly' && <div className="row"><span>Tiền ứng tại Makko</span><b>{money(d.price)}</b></div>}</div><div className="box"><h3>Khách hàng & địa chỉ nhận</h3><b>{d.customerName}</b><p>{d.recipientName} · <a href={`tel:${d.recipientPhone}`}>{d.recipientPhone}</a></p><p>{d.deliveryAddress}</p><p className="muted">{d.type === 'weekly' ? 'Giao chậm nhất Chủ nhật, ' : 'Hạn giao: '}{date(d.deliveryDeadline)}</p></div>{d.items.length > 0 && <div className="box"><h3>Hàng hóa</h3>{d.items.map((i, n) => <div className="row" key={n}><span>{i.name}{i.note && <small>{i.note}</small>}</span><b>{i.quantity} {i.unit}</b></div>)}</div>}{d.ingredients && <details className="box"><summary>Nguyên liệu trong gói</summary><p className="menu-help">Định lượng chuẩn cho 1 người, 1 bữa/ngày trong 7 ngày; nhân theo số người và nhân đôi với gói trưa và tối.</p>{d.ingredients.map((v,i) => <div className="row" key={i}><span>{v.name}</span><b>{v.quantity}</b></div>)}</details>}</div><div><div className="box"><h3>Người đi giúp</h3><b>{d.shopperName || 'Chưa có người nhận'}</b>{d.type === 'weekly' && <p className="muted">Nhận nguyên liệu tại điểm Makko, Đà Nẵng.</p>}</div><div className="box"><h3>Tiến trình đơn</h3>{d.history.length ? <ol className="steps">{d.history.map((h, i) => <li className="done" key={i}>{labels[h.status] || h.status}<small>{date(h.createdAt)}</small></li>)}</ol> : <p>{labels[d.status] || d.status}</p>}{d.handoverAt && <p>Makko đã bàn giao: {date(d.handoverAt)}</p>}{d.completedAt && <p>Khách đã nhận: {date(d.completedAt)}</p>}{d.wagePaidAt && <p>Đã trả công: {date(d.wagePaidAt)}</p>}</div></div></div><div className="action-area">{canHand || canPay ? <><div className="notice">{canHand ? `Kiểm tra đúng người nhận, đủ nguyên liệu và đã thu ${money(d.price)} tiền ứng trước khi xác nhận.` : `Khách đã xác nhận nhận hàng. Trả riêng ${money(d.fee)} tiền công cho ${d.shopperName}.`}</div><button className="primary" disabled={busy} onClick={() => setConfirm(true)}>{canHand ? 'Xác nhận thu tiền ứng & bàn giao' : 'Xác nhận đã trả công 25.000đ'}</button></> : <p className="muted">{d.type === 'errand' ? 'Người đi giúp và khách hàng xác nhận các bước trên ứng dụng.' : d.wagePaidAt ? 'Đã hoàn tất bàn giao và trả công.' : 'Chưa có thao tác bàn giao hoặc trả công cần thực hiện.'}</p>}</div></>}</Overlay>}{confirm && d && <Overlay label="Xác nhận thao tác" onClose={() => { if (!busy)
        setConfirm(false); }}><div className="confirm-box"><h2>{canHand ? 'Xác nhận bàn giao?' : 'Xác nhận đã trả công?'}</h2><p>{canHand ? `Đã nhận ${money(d.price)} tiền ứng từ ${d.shopperName} và bàn giao đủ nguyên liệu?` : `Đã trả ${money(d.fee)} tiền mặt cho ${d.shopperName}?`}</p><div className="buttons"><button disabled={busy} onClick={() => setConfirm(false)}>Quay lại</button><button className="primary" disabled={busy} onClick={() => void act()}>{busy ? 'Đang ghi nhận…' : 'Xác nhận'}</button></div></div></Overlay>}</>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
