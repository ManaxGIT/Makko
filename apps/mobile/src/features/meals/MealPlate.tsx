import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';

/** Decorative illustration shared by the meal entry and suggestion cards. */
export function MealPlate() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.plate}>
    <View style={s.rim}><View style={s.rice} /><View style={[s.leaf, s.leafOne]} /><View style={[s.leaf, s.leafTwo]} /><View style={[s.food, s.foodOne]} /><View style={[s.food, s.foodTwo]} /><View style={s.vegetable} /></View>
  </View>;
}
const s = StyleSheet.create({
  plate: { width: 150, height: 150, borderRadius: 75, backgroundColor: colors.cream, padding: 10, transform: [{ rotate: '-12deg' }] },
  rim: { flex: 1, borderRadius: 70, backgroundColor: colors.background, borderWidth: 6, borderColor: colors.border },
  rice: { position: 'absolute', left: 15, top: 12, width: 57, height: 54, borderRadius: 24, backgroundColor: colors.surface },
  leaf: { position: 'absolute', width: 24, height: 60, borderRadius: 20, backgroundColor: colors.statusGreen },
  leafOne: { right: 13, top: 38, transform: [{ rotate: '30deg' }] },
  leafTwo: { right: 28, top: 61, transform: [{ rotate: '65deg' }] },
  food: { position: 'absolute', width: 43, height: 17, borderRadius: 8, backgroundColor: colors.coral },
  foodOne: { left: 12, bottom: 20, transform: [{ rotate: '-15deg' }] },
  foodTwo: { left: 29, bottom: 10, transform: [{ rotate: '15deg' }] },
  vegetable: { position: 'absolute', right: 18, top: 17, width: 29, height: 29, borderRadius: 15, backgroundColor: colors.orange },
});
