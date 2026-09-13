import { Redirect } from 'expo-router';

export default function VerifyScreen() {
  return <Redirect href="/auth/profile-setup" />;
}
