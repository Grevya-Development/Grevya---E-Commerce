import AuthPage from './AuthPage';
import type { AuthRole } from '@/lib/authService';

type RegistrationRole = Extract<AuthRole, 'buyer' | 'seller'>;

export default function Signup({ role = 'buyer' }: { role?: RegistrationRole }) {
  return <AuthPage mode="signup" role={role} />;
}
