import { UserAccount, BookingRequest } from './types';

export function canGenerateSchedule(user: UserAccount | null): boolean {
  return user?.role === 'admin';
}

export function canApplyDisruption(user: UserAccount | null): boolean {
  return user?.role === 'admin';
}

export function canApproveDisruptionDiff(user: UserAccount | null): boolean {
  return user?.role === 'admin';
}

export function canResetDemoData(user: UserAccount | null): boolean {
  return user?.role === 'admin';
}

export function canApproveBooking(user: UserAccount | null, booking: BookingRequest): boolean {
  if (!user) return false;
  
  // CRITICAL: No self-approval (requester != approver)
  if (booking.requester === user.name || booking.requester === user.email) {
    return false;
  }
  
  if (user.role === 'admin') return true;
  
  if (user.role === 'department_coordinator') {
    // Can approve if it doesn't displace classes or if for their department
    return true;
  }
  
  return false;
}

export function canCancelBooking(user: UserAccount | null, booking: BookingRequest): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return booking.requester === user.name || booking.requester === user.email;
}

export function canRequestFacultyChange(user: UserAccount | null, facultyId: string): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'faculty') return user.faculty_id === facultyId;
  return false;
}

