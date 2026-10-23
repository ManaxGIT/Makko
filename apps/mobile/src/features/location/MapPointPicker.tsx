import { Platform, StyleSheet, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { Coordinates } from './LocationProvider';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

export type MapPointPickerProps = { point: Coordinates | null; onSelect: (point: Coordinates) => void };
export function MapPointPicker({ point, onSelect }: MapPointPickerProps) {
  const key = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY : process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY;
  if (!key) return <Text style={styles.note}>Google Maps chưa được cấu hình. Bạn vẫn có thể nhập địa chỉ thủ công.</Text>;
  // The initial viewport is only a map overview; it is never a delivery coordinate.
  const center = point ?? { latitude: 16, longitude: 107 };
  return <MapView provider={PROVIDER_GOOGLE} style={styles.map}
    region={{ ...center, latitudeDelta: point ? 0.01 : 15, longitudeDelta: point ? 0.01 : 15 }}
    onPress={event => onSelect(event.nativeEvent.coordinate)}>
    {point && <Marker coordinate={point} draggable onDragEnd={event => onSelect(event.nativeEvent.coordinate)} />}
  </MapView>;
}
const styles = StyleSheet.create({
  map: { height: 240, borderRadius: 12, marginVertical: 10 },
  note: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, marginVertical: 10 },
});
