import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type ViewStyle,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from '@/theme/typography';

export function AuthScreen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthHeader({ showStep }: { showStep?: boolean }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      {showStep ? <Text style={styles.step}>BƯỚC 2/2</Text> : <Brand size="small" />}
    </View>
  );
}

export function Brand({ completed, size = 'large' }: { completed?: boolean; size?: 'small' | 'large' }) {
  const compact = size === 'small';
  return (
    <View style={[styles.brand, compact && styles.brandSmall]}>
      <Text style={[styles.brandText, compact && styles.brandTextSmall]}>m</Text>
      {completed ? <View style={styles.brandCheck}><Text style={styles.brandCheckText}>✓</Text></View> : null}
    </View>
  );
}

export function AuthIntro({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <View style={styles.intro}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

export function AuthField({ label, prefix, trailing, multiline, containerStyle, ...props }: TextInputProps & {
  label: string;
  prefix?: string;
  trailing?: ReactNode;
  containerStyle?: ViewStyle;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, multiline && styles.textareaWrap, containerStyle]}>
        {prefix ? <><Text style={styles.prefix}>{prefix}</Text><View style={styles.divider} /></> : null}
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor={colors.mutedLight}
          style={[styles.input, multiline && styles.textarea]}
        />
        {trailing}
      </View>
    </View>
  );
}

export function PrimaryButton({ children, disabled, onPress }: { children: ReactNode; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, (pressed || disabled) && styles.pressed]}><Text style={styles.primaryText}>{children}</Text></Pressable>;
}

export function SecondaryButton({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryText}>{children}</Text></Pressable>;
}

export function InlineLink({ before, label, onPress }: { before: string; label: string; onPress: () => void }) {
  return <Text style={styles.inlineText}>{before}<Text onPress={onPress} style={styles.inlineLink}>{label}</Text></Text>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 26 },
  content: { flexGrow: 1 },
  footer: { alignItems: 'center', paddingBottom: 12, paddingTop: 24 },
  header: { alignItems: 'center', flexDirection: 'row', height: 68, justifyContent: 'space-between' },
  backButton: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 11, height: 36, justifyContent: 'center', width: 36 },
  backText: { color: colors.text, fontFamily: fontFamilies.body, fontSize: 25, lineHeight: 27 },
  step: { backgroundColor: colors.cream, borderRadius: 12, color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6 },
  brand: { alignItems: 'center', backgroundColor: colors.forest, borderBottomLeftRadius: 10, borderBottomRightRadius: 31, borderTopLeftRadius: 31, borderTopRightRadius: 31, height: 96, justifyContent: 'center', position: 'relative', width: 96 },
  brandSmall: { borderBottomLeftRadius: 4, borderBottomRightRadius: 12, borderTopLeftRadius: 12, borderTopRightRadius: 12, height: 36, width: 36 },
  brandText: { color: colors.cream, fontFamily: fontFamilies.display, fontSize: 62, lineHeight: 70 },
  brandTextSmall: { fontSize: 25, lineHeight: 31 },
  brandCheck: { alignItems: 'center', backgroundColor: colors.success, borderColor: colors.cream, borderRadius: 21, borderWidth: 4, bottom: -7, height: 42, justifyContent: 'center', position: 'absolute', right: -11, width: 42 },
  brandCheckText: { color: colors.surface, fontFamily: fontFamilies.bodyBold, fontSize: 18 },
  intro: { gap: 7, paddingTop: 22 },
  eyebrow: { color: colors.coral, fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.caption, letterSpacing: letterSpacing.eyebrow },
  title: { color: colors.text, fontFamily: fontFamilies.display, fontSize: fontSizes.display, lineHeight: lineHeights.display },
  subtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall },
  fieldBlock: { gap: 7, marginTop: 16 },
  label: { color: '#80867F', fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.caption, letterSpacing: letterSpacing.label },
  inputWrap: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 49, paddingHorizontal: 13 },
  textareaWrap: { alignItems: 'flex-start', height: 65, paddingVertical: 10 },
  input: { color: colors.text, flex: 1, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, padding: 0 },
  textarea: { fontFamily: fontFamilies.body, height: '100%', textAlignVertical: 'top' },
  prefix: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall },
  divider: { backgroundColor: colors.border, height: 20, marginHorizontal: 10, width: 1 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.orange, borderRadius: 13, height: 47, justifyContent: 'center', marginTop: 14 },
  primaryText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  secondaryButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 13, borderWidth: 1, height: 47, justifyContent: 'center', marginTop: 8 },
  secondaryText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  inlineText: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, textAlign: 'center' },
  inlineLink: { color: colors.coral, fontFamily: fontFamilies.bodyBold },
  pressed: { opacity: 0.68 },
});
