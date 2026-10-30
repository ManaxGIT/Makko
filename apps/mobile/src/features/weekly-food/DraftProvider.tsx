import { createContext, useContext, useRef, useState, type PropsWithChildren } from 'react';
import type { Meals } from './api';
import { submissionId } from './model';
type Draft = {
    people: number;
    meals: Meals;
    setPeople: (n: number) => void;
    setMeals: (v: Meals) => void;
    getSubmissionKey: (signature: string) => string;
    reset: () => void;
};
const Context = createContext<Draft | null>(null);
export function FoodDraftProvider({ children }: PropsWithChildren) {
    const [people, setPeople] = useState(2), [meals, setMeals] = useState<Meals>('dinner');
    const submission = useRef({ signature: '', id: submissionId() });
    return <Context.Provider value={{ people, meals, setPeople, setMeals, getSubmissionKey: signature => { if (signature !== submission.current.signature)
            submission.current = { signature, id: submissionId() }; return submission.current.id; }, reset: () => { submission.current = { signature: '', id: submissionId() }; } }}>{children}</Context.Provider>;
}
export function useFoodDraft() { const value = useContext(Context); if (!value)
    throw new Error('Missing FoodDraftProvider'); return value; }
