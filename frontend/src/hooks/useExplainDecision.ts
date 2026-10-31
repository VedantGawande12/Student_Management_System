import { useState, useCallback } from 'react';
import { explainDecision as apiExplainDecision, checkFacultyChange as apiCheckFacultyChange } from '../core/api';

export function useExplainDecision() {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [facultyChangeResult, setFacultyChangeResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const explainBooking = useCallback(async (decision: any, request: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiExplainDecision(decision, request);
      setExplanation(res.explanation);
      return res.explanation;
    } catch (err: any) {
      setError(err.message || 'Failed to explain booking');
    } finally {
      setLoading(false);
    }
  }, []);

  const evaluateFacultyChange = useCallback(async (change: {
    session_id: string;
    preferred_day: string;
    preferred_start_period: number;
    note?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiCheckFacultyChange(change);
      setFacultyChangeResult(res);
      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate faculty change');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    explanation,
    facultyChangeResult,
    error,
    explainBooking,
    evaluateFacultyChange
  };
}

