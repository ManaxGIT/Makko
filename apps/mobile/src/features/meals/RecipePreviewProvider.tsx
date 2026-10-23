import { createContext, PropsWithChildren, useContext, useState } from 'react';
import type { RecipeSnapshot } from './api';

// Lives only in the meal navigator; never modifies the shopping form on preview.
const Context = createContext<{
  recipe: RecipeSnapshot | null;
  setRecipe: (recipe: RecipeSnapshot) => void;
} | null>(null);

export function RecipePreviewProvider({ children }: PropsWithChildren) {
  const [recipe, setRecipe] = useState<RecipeSnapshot | null>(null);
  return <Context.Provider value={{ recipe, setRecipe }}>{children}</Context.Provider>;
}

export function useRecipePreview() {
  const value = useContext(Context);
  if (!value) throw new Error('RecipePreviewProvider is required');
  return value;
}
