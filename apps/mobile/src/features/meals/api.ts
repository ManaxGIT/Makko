import { apiGet, apiPost } from '@/lib/api';

export type MealPreferences = { meal: string; people: number; budget: number; avoid: string; pantry: string; style?: string };
export type RecipeSnapshot = {
  title: string; cookingMinutes: number; servings: number;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps: string[];
};
export type MealSuggestion = {
  title: string;
  description: string;
  cookingMinutes: number;
  suggestedGoodsAmount: number;
  ingredients: { name: string; quantity: number; unit: string; note?: string }[];
  recipe: RecipeSnapshot;
};
export type MealSuggestions = { suggestions: MealSuggestion[] };

export function suggestMeals(preferences: MealPreferences, userId: string) {
  return apiPost<MealSuggestions>('/api/v1/meals/suggestions', preferences, userId);
}

export function getOrderRecipe(id: string) { return apiGet<RecipeSnapshot>(`/api/v1/orders/${id}/recipe`); }
