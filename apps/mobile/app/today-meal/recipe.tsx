import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { RecipeContent } from '@/features/meals/RecipeContent';
import { useRecipePreview } from '@/features/meals/RecipePreviewProvider';
import { colors } from '@/theme/colors';

export default function RecipePreviewScreen() {
  const { recipe } = useRecipePreview();
  if (!recipe) return <Redirect href="/today-meal" />;
  // Native stack header owns the top safe area and the iOS back gesture.
  return <SafeAreaView style={s.safe} edges={['bottom', 'left', 'right']}><RecipeContent recipe={recipe} /></SafeAreaView>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background } });
