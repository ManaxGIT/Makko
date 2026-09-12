import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontSizes } from '@/theme/typography';

type ScreenPlaceholderProps = {
  eyebrow: string;
  title: string;
};

export function ScreenPlaceholder({ eyebrow, title }: ScreenPlaceholderProps) {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>Màn hình này sẽ được phát triển ở bước tiếp theo.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 28 },
  eyebrow: {
    color: colors.coral,
    fontSize: fontSizes.body,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontFamily: 'serif',
    fontSize: fontSizes.display,
    fontWeight: '800',
    marginTop: 6,
  },
  message: { color: colors.muted, fontSize: fontSizes.body, marginTop: 16 },
});
