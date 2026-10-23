import type { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';
import { formatDeliveryAddress, fromSavedAddress } from './addressForm';
import type { SavedAddress } from './api';

export function AddressButton({ children, onPress, disabled = false, secondary = false }: PropsWithChildren<{ onPress: () => void; disabled?: boolean; secondary?: boolean }>) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled }} onPress={onPress} style={[a.button, secondary && a.secondary, disabled && a.disabled]}><Text style={a.buttonText}>{children}</Text></Pressable>;
}
export function AddressCard({ address, selected, onPress, children }: PropsWithChildren<{ address: SavedAddress; selected?: boolean; onPress?: () => void }>) {
  const content = <><View style={a.row}><View style={a.icon}><Text style={a.iconText}>{address.label === 'Nhà' ? '⌂' : '⌖'}</Text></View><Text style={[a.bold, a.flex]}>{address.label}</Text>{address.isDefault && <Text style={a.badge}>Mặc định</Text>}{onPress && <View style={[a.radio, selected && a.checked]} />}</View><Text style={[a.smallBold, a.recipient]}>{address.recipientName} · {address.recipientPhone}</Text><Text style={a.body}>{formatDeliveryAddress(fromSavedAddress(address))}</Text>{!!address.deliveryNote && <Text style={a.hint}>{address.deliveryNote}</Text>}{children}</>;
  return onPress ? <Pressable accessibilityRole="radio" accessibilityLabel={`${address.label}, ${address.recipientName}, ${formatDeliveryAddress(fromSavedAddress(address))}`} accessibilityState={{ checked: !!selected }} onPress={onPress} style={[a.card, selected && a.selected]}>{content}</Pressable> : <View style={a.card}>{content}</View>;
}
export function AddressSheet({ visible, title, onClose, children, footer }: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void; footer?: React.ReactNode }>) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={a.overlay}><Pressable accessibilityLabel="Đóng popup" onPress={onClose} style={StyleSheet.absoluteFill} /><SafeAreaView edges={['bottom', 'left', 'right']} accessibilityViewIsModal style={a.sheet}><View style={a.handle} /><View style={a.sheetHeader}><Text accessibilityRole="header" style={[a.sheetTitle, a.flex]}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={onClose} style={a.close}><Text style={a.closeText}>×</Text></Pressable></View>{children}{footer && <View style={a.footer}>{footer}</View>}</SafeAreaView></View></Modal>;
}
export const a = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  content: { padding: 20, gap: 12 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, between: { justifyContent: 'space-between' },
  title: { fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle, color: colors.text },
  sheetTitle: { fontFamily: fontFamilies.display, fontSize: fontSizes.sectionTitle, lineHeight: lineHeights.sectionTitle, color: colors.text },
  bold: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body, color: colors.forest },
  smallBold: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest },
  body: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.muted },
  hint: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.muted, marginTop: 6 },
  error: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.coral },
  link: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest },
  danger: { color: colors.coral }, disabled: { opacity: 0.5 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface, padding: 16, marginBottom: 12 },
  selected: { borderColor: colors.forest, backgroundColor: colors.chip }, recipient: { marginTop: 12, marginBottom: 5 },
  icon: { backgroundColor: colors.cream, width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.sectionTitle },
  badge: { backgroundColor: colors.cream, color: colors.brown, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 4, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.mutedLight }, checked: { borderWidth: 6, borderColor: colors.forest },
  button: { minHeight: 48, borderRadius: 13, backgroundColor: colors.orange, justifyContent: 'center', alignItems: 'center', padding: 13 },
  buttonText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.action, lineHeight: lineHeights.body, color: colors.forest },
  secondary: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 13, paddingTop: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  touch: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  footer: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 8 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#142B2359' },
  sheet: { maxHeight: '80%', backgroundColor: colors.background, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  handle: { width: 36, height: 4, borderRadius: 9, backgroundColor: colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 3 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 7, paddingBottom: 10 },
  close: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' }, closeText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.pageTitle },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: 48, color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall },
  field: { gap: 7, marginVertical: 8 }, empty: { alignItems: 'center', paddingVertical: 35, gap: 10 },
});
