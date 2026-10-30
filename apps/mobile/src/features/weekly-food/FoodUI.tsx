import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { OrderScreenHeader } from '@/features/orders/OrderScreenHeader';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from '@/theme/typography';
export function FoodButton({ children, onPress, disabled, secondary, danger }: PropsWithChildren<{
    onPress: () => void;
    disabled?: boolean;
    secondary?: boolean;
    danger?: boolean;
}>) {
    return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, danger && s.dangerButton, (disabled || pressed) && s.dim]}><Text style={[s.buttonText, danger && s.dangerText]}>{children}</Text></Pressable>;
}
export function FoodScreen({ title, children, footer, refreshing = false, onRefresh }: PropsWithChildren<{
    title: string;
    footer?: ReactNode;
    refreshing?: boolean;
    onRefresh?: () => void;
}>) {
    const router = useRouter();
    return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><OrderScreenHeader title={title} onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}/><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.forest}/> : undefined}>{children}</ScrollView>{footer && <View style={s.footer}>{footer}</View>}</SafeAreaView>;
}
export function FoodError({ message, retry }: {
    message: string;
    retry?: () => void;
}) { return message ? <View style={s.gap}><Text accessibilityRole="alert" style={s.error}>{message}</Text>{retry && <FoodButton secondary onPress={retry}>Thử lại</FoodButton>}</View> : null; }
export function FoodLoading() { return <ActivityIndicator color={colors.forest} style={{ margin: 24 }}/>; }
export function FoodRow({ label, value }: {
    label: string;
    value: string;
}) { return <View style={s.row}><Text style={[s.small, { flex: 1 }]}>{label}</Text><Text style={[s.bold, { flex: 1.5, textAlign: 'right' }]}>{value}</Text></View>; }
export function BasketArt() {
    return <View accessible={false} importantForAccessibility="no-hide-descendants" style={art.canvas}><View style={art.halo}/><View style={art.handle}/><View style={[art.leaf, { right: 12, transform: [{ rotate: '38deg' }] }]}/><View style={[art.leaf, { right: 35, transform: [{ rotate: '-15deg' }] }]}/><View style={art.carrotTop}/><View style={art.carrot}/><View style={art.egg}/><View style={art.tomato}/><View style={art.basket}><View style={art.rim}/><View style={art.weaveRow}>{[0, 1, 2, 3, 4].map(i => <View key={i} style={art.weave}/>)}</View><View style={art.cross}/></View></View>;
}
export const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, gap: 18, paddingBottom: 28 },
    footer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, gap: 10 },
    title: { fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle, color: colors.forest },
    sectionTitle: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.sectionTitle, lineHeight: lineHeights.sectionTitle, color: colors.forest },
    body: { fontFamily: fontFamilies.body, fontSize: fontSizes.body, lineHeight: lineHeights.body, color: colors.forest },
    small: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.muted },
    bold: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest },
    label: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest, marginBottom: 10 },
    eyebrow: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, letterSpacing: letterSpacing.eyebrow, color: colors.coral },
    error: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.coral },
    button: { minHeight: 48, padding: 14, borderRadius: 13, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
    buttonText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.action, lineHeight: lineHeights.body, color: colors.forest },
    secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, dangerButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.coral }, dangerText: { color: colors.coral }, dim: { opacity: 0.5 },
    card: { padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, gap: 10 },
    info: { padding: 14, borderRadius: 12, backgroundColor: colors.chip, gap: 6 }, gap: { gap: 10 }, row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
    choices: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, choice: { flex: 1, minHeight: 46, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 }, selected: { borderColor: colors.orange, backgroundColor: colors.cream },
    link: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.coral, paddingVertical: 10 },
    badge: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.forest, backgroundColor: colors.cream, padding: 8, borderRadius: 12, alignSelf: 'flex-start', overflow: 'hidden' },
    hero: { padding: 20, borderRadius: 24, backgroundColor: colors.cream, minHeight: 205, justifyContent: 'center', gap: 10, overflow: 'hidden' },
    heroCopy: { maxWidth: '70%', gap: 10 }, heroArt: { position: 'absolute', right: -18, bottom: 10, transform: [{ scale: 0.85 }] },
    line: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 14, gap: 7 },
});
const art = StyleSheet.create({
    canvas: { width: 145, height: 175 }, halo: { width: 113, height: 113, borderRadius: 60, backgroundColor: colors.goldLight, position: 'absolute', top: 20, right: 0 },
    handle: { position: 'absolute', width: 88, height: 94, borderRadius: 48, borderWidth: 7, borderColor: colors.brown, left: 35, top: 30 },
    leaf: { position: 'absolute', width: 28, height: 75, borderRadius: 25, backgroundColor: colors.statusGreen, top: 44 },
    carrotTop: { position: 'absolute', width: 22, height: 30, borderRadius: 8, backgroundColor: colors.statusGreen, left: 27, top: 24, transform: [{ rotate: '-20deg' }] },
    carrot: { position: 'absolute', width: 25, height: 76, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, backgroundColor: colors.orange, left: 38, top: 46, transform: [{ rotate: '-23deg' }] },
    egg: { position: 'absolute', width: 38, height: 50, borderRadius: 24, backgroundColor: colors.surface, left: 64, top: 80, transform: [{ rotate: '18deg' }] },
    tomato: { position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: colors.coral, left: 20, top: 90 },
    basket: { position: 'absolute', left: 10, right: 0, bottom: 9, height: 55, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, backgroundColor: colors.orange, borderBottomWidth: 4, borderColor: colors.brown, overflow: 'hidden' },
    rim: { height: 7, backgroundColor: colors.brown }, weaveRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-evenly' }, weave: { width: 3, height: 47, backgroundColor: colors.cream }, cross: { height: 3, backgroundColor: colors.cream, position: 'absolute', top: 30, left: 0, right: 0 },
});
