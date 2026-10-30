import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { FoodDraftProvider } from '@/features/weekly-food/DraftProvider';
import { colors } from '@/theme/colors';
export default function WeeklyFoodLayout() {
    const { isLoading, session } = useAuth();
    if (isLoading)
        return null;
    if (!session)
        return <Redirect href="/auth/login"/>;
    return <FoodDraftProvider key={session.user.id}><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}/></FoodDraftProvider>;
}
