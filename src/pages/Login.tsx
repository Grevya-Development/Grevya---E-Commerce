import AuthPage from './AuthPage';
import type { AuthRole } from '@/lib/authService';

export default function Login({ role = 'buyer' }: { role?: AuthRole }) {
  return <AuthPage mode="login" role={role} />;
}
