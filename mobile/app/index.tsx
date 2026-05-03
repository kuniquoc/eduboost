import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (user?.role === 'teacher') return <Redirect href="/(teacher)" />;
  return <Redirect href="/(student)" />;
}
