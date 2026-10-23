import { Text } from 'react-native';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';
import type { Coordinates } from './LocationProvider';
export type MapPointPickerProps = { point: Coordinates | null; onSelect: (point: Coordinates) => void };
export function MapPointPicker(_: MapPointPickerProps) {
  return <Text style={{ color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall }}>Chọn điểm Google Maps trong ứng dụng iPhone hoặc Android. Trên web, bạn vẫn có thể nhập địa chỉ thủ công.</Text>;
}
