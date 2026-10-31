import { useState, useEffect, useCallback } from 'react';
import { UserAccount, TestCredential, BookingRequest } from '../core/types';
import {
  login as apiLogin,
  logout as apiLogout,
  switchUser,
  getTestCredentials,
  clearStoredToken
} from '../core/api';

export function useRoleAuth(initialUser?: UserAccount) {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(initialUser || null);
  const [testCredentials, setTestCredentials] = useState<TestCredential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load test credentials once on mount
  useEffect(() => {
    let mounted = true;
    getTestCredentials()
      .then((creds) => {
        if (mounted) setTestCredentials(creds);
      })
      .catch((err) => {
        console.warn('Could not fetch test credentials:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiLogin(email, password);
      setCurrentUser(res.user);
      return res.user;
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

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

  const logoutUser = useCallback(async () => {
    setLoading(true);
    try {
      await apiLogout();
      clearStoredToken();
      // Reset to guest / empty
      setCurrentUser(null);
    } catch (err: any) {
      console.warn('Logout error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const canApproveBooking = useCallback(
    (booking: BookingRequest): boolean => {
      if (!currentUser) return false;
      const isApproverRole =
        currentUser.role === 'admin' || currentUser.role === 'department_coordinator';
      if (!isApproverRole) return false;

      // STRICT NO SELF-APPROVAL: requester cannot equal approver
      if (
        booking.requester === currentUser.name ||
        booking.requester === currentUser.email
      ) {
        return false;
      }
      return true;
    },
    [currentUser]
  );

  return {
    currentUser,
    setCurrentUser,
    testCredentials,
    changeRole,
    loginWithPassword,
    logoutUser,
    loading,
    error,
    setError,
    isAdmin: currentUser?.role === 'admin',
    isCoordinator: currentUser?.role === 'department_coordinator',
    isFaculty: currentUser?.role === 'faculty',
    isClub: currentUser?.role === 'club',
    canApproveBooking,
    canSolveSchedule: currentUser?.role === 'admin',
    canManageDisruptions: currentUser?.role === 'admin'
  };
}
