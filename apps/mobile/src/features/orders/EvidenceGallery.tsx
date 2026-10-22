import { useCallback, useMemo, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getEvidence } from './evidence';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

type Photo = Awaited<ReturnType<typeof getEvidence>>[number];

export function EvidenceGallery({ requestId, category = 'all' }: { requestId: string; category?: 'all' | 'purchase' | 'delivery' }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [attempt, setAttempt] = useState(0);
  const dismissGesture = useMemo(() => PanResponder.create({
    // The image stage has no nested controls: own its touches from the start.
    // Accept either horizontal direction, including the usual iOS back swipe.
    onStartShouldSetPanResponder: (_, gesture) => gesture.numberActiveTouches === 1,
    onMoveShouldSetPanResponderCapture: (_, gesture) => gesture.numberActiveTouches === 1
      && Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_, gesture) => {
      const horizontal = Math.abs(gesture.dx);
      if (horizontal >= 50 && horizontal > Math.abs(gesture.dy) * 1.5) {
        setSelected(null);
      }
    },
  }), []);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(''); setPhotos([]); setSelected(null);
    void getEvidence(requestId, category)
      .then(result => { if (active) setPhotos(result); })
      .catch(() => { if (active) setError('Không tải được ảnh.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestId, category, attempt]));
  const goods = photos.filter(photo => photo.kind === 'goods');
  const delivery = photos.filter(photo => photo.kind === 'delivery');
  const photoTitle = (photo: Photo | null) => photo?.kind === 'delivery' ? 'Ảnh giao hàng' : photo?.kind === 'receipt' ? 'Hóa đơn đính kèm' : 'Ảnh hàng đã mua';
  const receipts = photos.filter(photo => photo.kind === 'receipt');
  const retry = () => { setSelected(null); setAttempt(value => value + 1); };
  return <View style={s.box}>
    <View style={s.heading}><Text style={s.title}>{category === 'delivery' ? 'Minh chứng giao hàng' : 'Ảnh minh chứng'}</Text>{!loading && !error && <Text style={s.badge}>{photos.length} ảnh</Text>}</View>
    {loading ? <Text style={s.body}>Đang tải ảnh…</Text> : error ? <Pressable accessibilityRole="button" onPress={retry}><Text style={s.link}>{error} Chạm để thử lại.</Text></Pressable> : !photos.length ? <Text style={s.body}>Chưa có minh chứng.</Text> : <>
      {!!goods.length && <><Text style={s.body}>Ảnh hàng đã mua · Chạm để xem lớn</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>{goods.map((photo, index) => <Pressable key={photo.storagePath} accessibilityRole="button" accessibilityLabel={`Xem ảnh hàng ${index + 1}`} onPress={() => setSelected(photo)}><Image source={{ uri: photo.url }} style={s.image} onError={() => setError('Ảnh hết hạn hoặc không tải được.')} /><Text style={s.index}>{index + 1}/{goods.length}</Text></Pressable>)}</ScrollView></>}
      {!!delivery.length && <><Text style={s.body}>Ảnh giao hàng · Chạm để xem lớn</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>{delivery.map((photo, index) => <Pressable key={photo.storagePath} accessibilityRole="button" accessibilityLabel={`Xem ảnh giao hàng ${index + 1}`} onPress={() => setSelected(photo)}><Image source={{ uri: photo.url }} style={s.image} onError={() => setError('Ảnh hết hạn hoặc không tải được.')} /><Text style={s.index}>{index + 1}/{delivery.length}</Text></Pressable>)}</ScrollView></>}
      {!!receipts.length && <View style={s.receipts}><Text style={s.title}>Hóa đơn đính kèm · {receipts.length} ảnh</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>{receipts.map((photo, index) => <Pressable key={photo.storagePath} accessibilityRole="button" accessibilityLabel={`Xem hóa đơn ${index + 1}`} onPress={() => setSelected(photo)}><Image source={{ uri: photo.url }} style={s.image} onError={() => setError('Ảnh hết hạn hoặc không tải được.')} /></Pressable>)}</ScrollView></View>}
    </>}
    <Modal visible={selected !== null} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setSelected(null)}>
      <SafeAreaProvider>
        <SafeAreaView style={s.viewer} edges={['top', 'right', 'bottom', 'left']}>
          <View style={s.viewerHeader}>
            <Text style={s.viewerTitle}>{photoTitle(selected)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng ảnh" onPress={() => setSelected(null)} style={s.close}>
              <Text style={s.link}>Đóng</Text>
            </Pressable>
          </View>
          <View style={s.imageStage} collapsable={false} {...dismissGesture.panHandlers}>
            {selected && <View pointerEvents="none" style={s.large}><Image
              accessibilityLabel={photoTitle(selected)}
              source={{ uri: selected.url }}
              style={s.large}
              resizeMode="contain"
              onError={() => setError('Ảnh hết hạn hoặc không tải được.')}
            /></View>}
          </View>
          {!!error && <Pressable accessibilityRole="button" onPress={retry} style={s.viewerError}><Text style={s.link}>{error} Chạm để tải lại.</Text></Pressable>}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  </View>;
}
const s = StyleSheet.create({
  box: { padding: 12, gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.forest, flexShrink: 1 },
  body: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.muted },
  badge: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, color: colors.brown, backgroundColor: colors.cream, padding: 5, borderRadius: 10 },
  link: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.coral, lineHeight: lineHeights.bodySmall },
  strip: { gap: 8 }, image: { width: 116, height: 104, backgroundColor: colors.chip, borderRadius: 10 },
  index: { position: 'absolute', bottom: 6, left: 6, color: colors.surface, backgroundColor: colors.forest, padding: 4, borderRadius: 5, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  receipts: { gap: 10, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border },
  viewer: { flex: 1, backgroundColor: colors.background },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingVertical: 8, minHeight: 60, borderBottomWidth: 1, borderBottomColor: colors.border },
  viewerTitle: { flex: 1, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body, color: colors.forest },
  close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  imageStage: { flex: 1, padding: 12 },
  large: { width: '100%', height: '100%' },
  viewerError: { paddingHorizontal: 20, paddingVertical: 12 },
});
