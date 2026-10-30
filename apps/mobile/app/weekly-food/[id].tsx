import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { AddressSheet } from '@/features/addresses/AddressUI';
import { supabase } from '@/lib/supabase';
import { actFood, getFoodDetail, type FoodDetail } from '@/features/weekly-food/api';
import { useFoodResource } from '@/features/weekly-food/useFoodResource';
import { FoodButton, FoodError, FoodLoading, FoodRow, FoodScreen, s } from '@/features/weekly-food/FoodUI';
import { canCancel, canRelease, cutoff, day, foodPlan, money, statusLabel, submissionId } from '@/features/weekly-food/model';
import { EvidencePhotoPicker, EvidencePhotoStrip } from '@/features/orders/EvidencePhotoInput';
import { MenuSheet } from '@/features/weekly-food/MenuSheet';
import { colors } from '@/theme/colors';
type Action = 'cancel' | 'release' | 'deliver' | 'receive';
type Photo = {
    key: string;
    uri: string;
    base64: string;
    storagePath?: string;
};
export default function FoodTrackingScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <FoodTracking key={id} id={id} />;
}
function FoodTracking({ id }: { id: string }) {
    const router = useRouter(), { session } = useAuth();
    const resource = useFoodResource<FoodDetail>(`detail:${id}`, userId => getFoodDetail(id, userId), 10000, true);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirm, setConfirm] = useState<Action | null>(null), [photo, setPhoto] = useState<Photo | null>(null), [menu, setMenu] = useState(false);
    const working = useRef(false), alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const order = resource.data, customer = order?.customerId === session?.user.id;
    const badge = order && !customer ? ({ registered: 'Gói nguyên liệu Makko', accepted: 'Bạn đã nhận giao', delivering: 'Đã nhận hàng', delivered: 'Chờ khách xác nhận', completed: 'Giao thành công', cancelled: 'Đã hủy' })[order.status] : order ? statusLabel(order) : '';
    async function pick(camera = false) {
        if (working.current)
            return;
        working.current = true;
        setBusy(true);
        setError('');
        try {
            if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExponentImagePicker'))
                throw new Error('Bản Makko đang cài chưa hỗ trợ chọn ảnh. Vui lòng cài bản ứng dụng mới.');
            const picker = await import('expo-image-picker');
            if (camera) {
                const permission = await picker.requestCameraPermissionsAsync();
                if (!permission.granted)
                    throw new Error('Cho phép truy cập camera hoặc chọn ảnh từ thư viện.');
            }
            const options = { mediaTypes: ['images'] as [
                    'images'
                ], allowsEditing: true, quality: 0.7, base64: true };
            const result = camera ? await picker.launchCameraAsync(options) : await picker.launchImageLibraryAsync(options);
            if (result.canceled || !alive.current)
                return;
            const asset = result.assets[0];
            if (!asset.base64 || asset.base64.length * 0.75 > 10 * 1024 * 1024)
                throw new Error('Chọn ảnh JPEG, PNG hoặc WebP nhỏ hơn 10 MB.');
            setPhoto({ key: submissionId(), uri: asset.uri, base64: asset.base64 });
        }
        catch (e) {
            if (alive.current)
                setError(e instanceof Error ? e.message : 'Không mở được ảnh.');
        }
        finally {
            working.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    async function submit() {
        if (!order || !session || !confirm || working.current)
            return;
        const action = confirm;
        working.current = true;
        setBusy(true);
        setError('');
        try {
            const paths: string[] = [];
            if (action === 'deliver') {
                if (!photo)
                    throw new Error('Thêm ít nhất một ảnh bàn giao trước khi xác nhận đã giao.');
                const { data: { session: current } } = await supabase.auth.getSession();
                if (!current || current.user.id !== session.user.id)
                    throw new Error('Tài khoản đã thay đổi. Vui lòng mở lại gói.');
                let path = photo.storagePath;
                if (!path) {
                    const bytes = Uint8Array.from(atob(photo.base64), c => c.charCodeAt(0));
                    const kind = bytes[0] === 255 && bytes[1] === 216 ? ['jpg', 'image/jpeg'] : bytes[0] === 137 && bytes[1] === 80 ? ['png', 'image/png'] : bytes[0] === 82 && bytes[8] === 87 && bytes[9] === 69 ? ['webp', 'image/webp'] : null;
                    if (!kind)
                        throw new Error('Chọn ảnh JPEG, PNG hoặc WebP.');
                    path = `${session.user.id}/${order.id}/${photo.key}.${kind[0]}`;
                    const uploaded = await supabase.storage.from('weekly-food-delivery').upload(path, bytes, { contentType: kind[1], upsert: false });
                    if (uploaded.error)
                        throw new Error('Chưa tải được ảnh bàn giao. Vui lòng kiểm tra kết nối và thử lại.');
                    if (!alive.current)
                        return;
                    setPhoto({ ...photo, storagePath: path });
                }
                paths.push(path);
            }
            if (!alive.current)
                return;
            const result = await actFood(order.id, action, session.user.id, paths);
            if (!alive.current)
                return;
            setConfirm(null);
            if (action === 'release') {
                router.replace('/(tabs)/orders');
                return;
            }
            resource.setData({ ...order, status: result.status });
            await resource.refresh(true);
        }
        catch (e) {
            if (alive.current) {
                setConfirm(null);
                setError(e instanceof Error ? e.message : 'Chưa xác nhận được kết quả. Hãy làm mới gói trước khi thử lại.');
                await resource.refresh(true);
            }
        }
        finally {
            working.current = false;
            if (alive.current)
                setBusy(false);
        }
    }
    const footer = order && <>{customer ? <>{order.status === 'delivered' ? <FoodButton disabled={busy} onPress={() => setConfirm('receive')}>Đã nhận hàng & thanh toán</FoodButton> : order.status === 'completed' || order.status === 'cancelled' ? <FoodButton secondary onPress={() => router.push('/account/order-history')}>Xem lịch sử đơn hàng</FoodButton> : <FoodButton danger disabled={busy || !canCancel(order)} onPress={() => setConfirm('cancel')}>Hủy đăng ký</FoodButton>}<Text style={s.small}>{order.status === 'completed' ? 'Gói kết thúc, không tự gia hạn.' : order.status === 'cancelled' ? 'Đăng ký đã được hủy.' : order.status === 'delivered' ? 'Chỉ xác nhận khi đã nhận đủ hàng và trả tiền.' : canCancel(order) ? `Có thể hủy đến ${day(cutoff(order))}.` : 'Đã qua hạn hủy. Makko đang chuẩn bị giao gói.'}</Text></> : <>{order.status === 'delivering' ? <FoodButton disabled={busy || !photo} onPress={() => setConfirm('deliver')}>Đã giao hàng & thu tiền</FoodButton> : order.status === 'completed' ? <Text style={s.bold}>{order.wagePaidAt ? 'Đã nhận tiền công 25.000đ tại Makko.' : 'Chờ nhận tiền công 25.000đ tại điểm Makko.'}</Text> : <FoodButton disabled onPress={() => { }}>{order.status === 'accepted' ? 'Chờ Makko bàn giao hàng' : 'Chờ khách xác nhận'}</FoodButton>}{order.status === 'accepted' && <FoodButton danger disabled={busy || !canRelease(order)} onPress={() => setConfirm('release')}>Hủy nhận giao</FoodButton>}</>}</>;
    return <FoodScreen title={customer ? 'Gói đã đăng ký' : 'Giao gói Makko'} refreshing={resource.fetching && !!order} onRefresh={() => void resource.refresh(true)} footer={footer || undefined}>{resource.fetching && !order && <FoodLoading />}<FoodError message={resource.error || error} retry={() => void resource.refresh(true)}/>{order && <><Text style={s.badge}>{badge}</Text><Text style={s.title}>{customer ? 'Bữa cơm tuần tới\nđã có Makko.' : 'Giao một gói,\ngửi đủ bữa nhà.'}</Text><View style={s.card}><Text style={s.sectionTitle}>{foodPlan(order)}</Text><FoodRow label="Giao chậm nhất" value={`Chủ nhật, ${day(order.deliveryDeadline)}`}/><FoodRow label="Người nhận" value={`${order.recipientName} · ${order.recipientPhone}`}/><FoodRow label="Địa chỉ" value={order.deliveryAddress}/><FoodRow label={order.status === 'completed' ? 'Đã thanh toán tiền mặt' : 'Tiền mặt khi nhận'} value={money(order.price)}/></View>{!customer && <><View style={s.info}><Text style={s.eyebrow}>TIỀN CÔNG RIÊNG TỪ MAKKO</Text><Text style={s.title}>25.000đ</Text><Text style={s.small}>Nhận tiền mặt tại điểm Makko sau khi khách xác nhận nhận hàng.</Text></View><View style={s.card}><Text style={s.sectionTitle}>Điểm nhận hàng Makko</Text><Text style={s.body}>Điểm cố định tại Đà Nẵng</Text><Text style={s.small}>Địa chỉ điểm nhận đang chờ thiết lập.</Text><FoodRow label="Ứng tại Makko" value={money(order.price)}/><FoodRow label="Thu lại từ khách" value={money(order.price)}/><FoodRow label="Tiền công nhận riêng" value="25.000đ"/></View>{order.status === 'accepted' && <View style={s.info}><Text style={s.small}>Chỉ hủy trong 24 giờ sau khi nhận đơn, còn ít nhất 72 giờ trước hạn Chủ nhật, chưa ứng tiền và chưa nhận hàng. Hủy rồi không được nhận lại đơn này.</Text></View>}</>}{order.status !== 'cancelled' && <View style={s.card}>{[{ label: 'Đăng ký thành công', done: true }, { label: 'Qua hạn hủy, mở nhận giao', done: !canCancel(order) }, { label: 'Đã có người nhận', done: !!order.shopperId }, { label: 'Đang giao đến bạn', done: !!order.handoverAt || ['delivering', 'delivered', 'completed'].includes(order.status) }, { label: 'Đã giao đến bạn', done: ['delivered', 'completed'].includes(order.status) }].map((step, i) => <View key={step.label} style={[s.row, { justifyContent: 'flex-start' }]}><View style={{ width: 10, height: 10, marginTop: 4, borderRadius: 5, backgroundColor: step.done ? colors.orange : colors.border }}/><View style={{ flex: 1, gap: 4 }}><Text style={step.done ? s.body : s.small}>{step.label}</Text>{i === 4 && order.status === 'completed' && <Text style={s.small}>Đã nhận hàng · Đã thanh toán tiền mặt</Text>}</View></View>)}</View>}{order.week && <Pressable accessibilityRole="button" onPress={() => setMenu(true)}><Text style={s.link}>Xem nguyên liệu trong gói →</Text></Pressable>}{!customer && order.status === 'delivering' && <View style={s.gap}><Text style={s.sectionTitle}>Ảnh bàn giao hàng</Text><Text style={s.small}>Thêm ít nhất một ảnh trước khi xác nhận đã giao.</Text><EvidencePhotoPicker title="Ảnh giao hàng" description="Chụp rõ hàng tại nơi giao. Không cần chụp khuôn mặt người nhận." disabled={busy} onPick={camera => void pick(camera)} libraryLabel="Chọn từ thư viện" showCamera={Platform.OS !== 'web'}/><EvidencePhotoStrip photos={photo ? [photo] : []} disabled={busy} onRemove={() => setPhoto(null)} imageLabel="Ảnh bàn giao đã chọn" removeLabel="Xóa ảnh bàn giao"/><Text style={s.small}>{photo ? '1 ảnh giao hàng' : 'Chưa có ảnh'}</Text></View>}{menu && order.week && <MenuSheet week={order.week} people={order.people} meals={order.meals} onClose={() => setMenu(false)}/>}</>}{confirm && order && <AddressSheet visible title={confirm === 'cancel' ? 'Hủy đăng ký gói?' : confirm === 'release' ? 'Hủy nhận giao?' : confirm === 'receive' ? 'Xác nhận nhận hàng' : 'Xác nhận đã giao'} onClose={() => { if (!busy)
        setConfirm(null); }} footer={<View style={s.gap}><FoodButton disabled={busy} danger={confirm === 'cancel' || confirm === 'release'} onPress={() => void submit()}>{busy ? 'Đang xác nhận…' : confirm === 'cancel' ? 'Hủy đăng ký' : confirm === 'release' ? 'Hủy nhận giao' : 'Xác nhận'}</FoodButton><FoodButton secondary disabled={busy} onPress={() => setConfirm(null)}>Quay lại</FoodButton></View>}><ScrollView contentContainerStyle={{ padding: 20 }}><Text style={s.body}>{confirm === 'cancel' ? 'Bạn cần đăng ký lại nếu muốn nhận gói hoặc thay đổi lựa chọn.' : confirm === 'release' ? 'Bạn sẽ không thể nhận lại gói này sau khi hủy nhận giao.' : confirm === 'receive' ? 'Bạn đã nhận đủ gói nguyên liệu và thanh toán tiền mặt cho người giao?' : `Bạn đã bàn giao hàng và thu đủ ${money(order.price)} tiền mặt từ khách?`}</Text></ScrollView></AddressSheet>}</FoodScreen>;
}
