import { Redirect } from 'expo-router';

// Keep previously opened links working after merging packages into Orders.
export default function LegacyWeeklyOrdersScreen() {
    return <Redirect href="/(tabs)/orders" />;
}
