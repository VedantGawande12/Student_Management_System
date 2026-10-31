import { useState, useCallback } from 'react';
import { DisruptionDiff, FullSchedule } from '../core/types';
import {
  applyDisruption as apiApplyDisruption,
  approveDisruption as apiApproveDisruption,
  rejectDisruption as apiRejectDisruption
} from '../core/api';

export function useDisruptionDiff(onDisruptionCommitted?: () => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [approving, setApproving] = useState(false);
  const [diff, setDiff] = useState<DisruptionDiff | null>(null);
  const [disruptedSchedule, setDisruptedSchedule] = useState<FullSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async (disruptionPayload?: any) => {
    setApplying(true);
    setError(null);
    try {
      const res = await apiApplyDisruption(disruptionPayload);
      setDiff(res.diff);
      setDisruptedSchedule(res.disrupted_schedule);
      setIsOpen(true);
      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to simulate disruption');
      throw err;
    } finally {
      setApplying(false);
    }
  }, []);

  const approve = useCallback(async () => {
    setApproving(true);
    setError(null);
    try {
      await apiApproveDisruption();
      setIsOpen(false);
      setDiff(null);
      setDisruptedSchedule(null);
      if (onDisruptionCommitted) onDisruptionCommitted();
    } catch (err: any) {
      setError(err.message || 'Failed to commit disruption');
      throw err;
    } finally {
      setApproving(false);
    }
  }, [onDisruptionCommitted]);

  const reject = useCallback(async () => {
    try {
      await apiRejectDisruption();
      setIsOpen(false);
      setDiff(null);
      setDisruptedSchedule(null);
      if (onDisruptionCommitted) onDisruptionCommitted();
    } catch (err: any) {
      setError(err.message || 'Failed to discard disruption');
    }
  }, [onDisruptionCommitted]);

  return {
    isOpen,
    setIsOpen,
    applying,
    approving,
    diff,
    disruptedSchedule,
    error,
    apply,
    approve,
    reject
  };
}

