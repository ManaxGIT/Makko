import { apiPost } from '@/lib/api';

export type MealPreferences = { meal: string; people: number; budget: number; avoid: string; pantry: string; style?: string };
export type MealSuggestion = {
  title: string;
  description: string;
  cookingMinutes: number;
  suggestedGoodsAmount: number;
  ingredients: { name: string; quantity: number; unit: string }[];
};
export type MealSuggestions = { suggestions: MealSuggestion[] };

export function suggestMeals(preferences: MealPreferences, userId: string) {
  return apiPost<MealSuggestions>('/api/v1/meals/suggestions', preferences, userId);
}
