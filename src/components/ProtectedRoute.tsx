import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  requiredRole?: 'owner' | 'admin' | 'owner_or_admin';
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { session, loading, isOwner, isAdmin, isOwnerOrAdmin, isCourier, isOffice } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === 'owner' && !isOwner) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === 'admin' && !isAdmin && !isOwner) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === 'owner_or_admin' && !isOwnerOrAdmin) {
    if (isOffice) return <Navigate to="/office-portal" replace />;
    return <Navigate to="/courier-orders" replace />;
  }

  return <>{children}</>;
}
