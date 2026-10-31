import { useState, useEffect, useCallback } from 'react';
import { UserAccount } from '../core/types';
import { switchUser } from '../core/api';

export function useRoleAuth(initialUser?: UserAccount) {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(initialUser || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeRole = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = await switchUser(email);
      setCurrentUser(user);
      return user;
    } catch (err: any) {
      setError(err.message || 'Failed to switch role');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    currentUser,
    setCurrentUser,
    changeRole,
    loading,
    error,
    isAdmin: currentUser?.role === 'admin',
    isCoordinator: currentUser?.role === 'department_coordinator',
    isFaculty: currentUser?.role === 'faculty',
    isClub: currentUser?.role === 'club'
  };
}

