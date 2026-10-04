import { useAuth } from './useAuth';
import { hasPermission, hasRole } from '../utils/rolePermissions';

export function usePermissions() {
  const { user } = useAuth();

  return {
    can: (permission) => user ? hasPermission(user.role, permission) : false,
    is: (...roles) => user ? hasRole(user.role, ...roles) : false,
  };
}
