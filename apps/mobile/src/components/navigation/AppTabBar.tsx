import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
>[0];

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const TAB_ICONS: Record<string, SymbolName> = {
  index: { ios: 'house', android: 'home', web: 'home' },
  explore: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  create: { ios: 'plus', android: 'add', web: 'add' },
  orders: { ios: 'list.clipboard', android: 'receipt_long', web: 'receipt_long' },
  profile: { ios: 'person', android: 'person', web: 'person' },
};

export function AppTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  if (state.routes[state.index]?.name === 'create') {
    return null;
  }

  return (
    <View
      style={[styles.safeArea, { paddingBottom: Math.min(insets.bottom, 8) }]}
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const options = descriptors[route.key].options;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const isCreate = route.name === 'create';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tab,
                isCreate && styles.createTab,
                pressed && styles.pressed,
              ]}
            >
              <View style={isCreate ? styles.createButton : styles.iconSlot}>
                <SymbolView
                  name={TAB_ICONS[route.name]}
                  size={isCreate ? 29 : 22}
                  tintColor={
                    isCreate ? colors.forest : isFocused ? '#E9823E' : '#979D97'
                  }
                  fallback={<Text style={styles.iconFallback}>{isCreate ? '+' : '•'}</Text>}
                />
              </View>
              {!isCreate && (
                <Text style={[styles.label, isFocused && styles.activeLabel]}>
                  {label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 54,
  },
  createTab: {
    alignSelf: 'flex-start',
    marginTop: -2,
  },
  createButton: {
    alignItems: 'center',
    backgroundColor: colors.orange,
    borderColor: colors.surface,
    borderRadius: 16,
    borderWidth: 4,
    height: 45,
    justifyContent: 'center',
    shadowColor: '#B56F35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    width: 45,
    elevation: 3,
  },
  iconSlot: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 28,
  },
  iconFallback: {
    color: colors.forest,
    fontSize: 25,
    lineHeight: 27,
  },
  label: {
    color: '#979D97',
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.body,
  },
  activeLabel: {
    color: '#E9823E',
    fontFamily: fontFamilies.bodyBold,
  },
  pressed: {
    opacity: 0.62,
  },
});
