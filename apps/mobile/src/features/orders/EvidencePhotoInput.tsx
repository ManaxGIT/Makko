import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

type SelectedPhoto = { key: string; uri: string };

export function EvidencePhotoPicker({ title, description, disabled, onPick, libraryLabel = 'Chọn ảnh', showCamera = true }: {
  title: string;
  description: string;
  disabled: boolean;
  onPick: (camera: boolean) => void;
  libraryLabel?: string;
  showCamera?: boolean;
}) {
  return <View style={s.upload}>
    <Text style={s.bold}>{title}</Text>
    <Text style={s.description}>{description}</Text>
    <View style={s.row}>
      {showCamera && <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} style={s.secondary} onPress={() => onPick(true)}><Text style={s.action}>Chụp ảnh</Text></Pressable>}
      <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} style={s.secondary} onPress={() => onPick(false)}><Text style={s.action}>{libraryLabel}</Text></Pressable>
    </View>
  </View>;
}

export function EvidencePhotoStrip({ photos, disabled, onRemove, imageLabel = 'Ảnh đã chọn', removeLabel = 'Xóa ảnh đã chọn' }: {
  photos: SelectedPhoto[];
  disabled: boolean;
  onRemove?: (key: string) => void;
  imageLabel?: string;
  removeLabel?: string;
}) {
  return <View style={s.photos}>{photos.map(photo => <View key={photo.key}>
    <Image accessibilityLabel={imageLabel} source={{ uri: photo.uri }} style={s.photo}/>
    {onRemove && <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} accessibilityLabel={removeLabel} hitSlop={6} style={s.remove} onPress={() => onRemove(photo.key)}><Text style={s.bold}>×</Text></Pressable>}
  </View>)}</View>;
}

const s = StyleSheet.create({
  bold: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.forest },
  description: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.muted, marginVertical: 8 },
  action: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.coral },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, minHeight: 44, backgroundColor: colors.surface },
  upload: { backgroundColor: colors.cream, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.orange, padding: 20, borderRadius: 16 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 },
  photo: { width: 96, height: 96, borderRadius: 12 },
  remove: { position: 'absolute', top: 0, right: 0, width: 32, height: 32, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
});
