import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getEvidence } from './evidence';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

export function EvidenceGallery({ requestId }: { requestId: string }) {
  const [photos, setPhotos] = useState<Awaited<ReturnType<typeof getEvidence>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setPhotos(await getEvidence(requestId)); }
    catch { setError('Không tải được minh chứng.'); }
    finally { setLoading(false); }
  }, [requestId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <View style={s.box}><Text style={s.title}>Minh chứng mua hàng</Text>
    {loading ? <Text style={s.body}>Đang tải ảnh…</Text> : error ? <Pressable onPress={load}><Text style={s.body}>{error} Bấm để thử lại.</Text></Pressable> : !photos.length ? <Text style={s.body}>Chưa có minh chứng.</Text> : photos.map(photo => <View key={photo.storagePath}><Text style={s.body}>{photo.kind === 'goods' ? 'Ảnh hàng đã mua' : 'Hóa đơn đính kèm'}</Text><Image accessibilityLabel={photo.kind === 'goods' ? 'Ảnh hàng đã mua' : 'Ảnh hóa đơn'} source={{ uri: photo.url }} style={s.image} resizeMode="contain" onError={() => setError('Ảnh hết hạn hoặc không tải được.')} /></View>)}
  </View>;
}
const s = StyleSheet.create({ box: { padding: 20, gap: 12 }, title: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, color: colors.forest }, body: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, color: colors.muted }, image: { width: '100%', height: 240, backgroundColor: colors.chip, borderRadius: 14, marginTop: 8 } });
