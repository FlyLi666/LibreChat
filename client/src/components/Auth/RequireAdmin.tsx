import { Navigate } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();

  if (user?.role !== SystemRoles.ADMIN) {
    return <Navigate to="/c/new" replace={true} />;
  }

  return <>{children}</>;
}
