import { useMemo } from 'react';
import { ValidatorReport } from '../core/types';

export function useValidatorReport(report: ValidatorReport | null) {
  const isClean = useMemo(() => {
    if (!report) return false;
    return report.hard_violation_count === 0 && (report.bookings?.priority_inversions?.length || 0) === 0;
  }, [report]);

  const hardCount = report?.hard_violation_count ?? 0;
  const softTotal = report?.soft_total ?? 0;
  const softBreakdown = report?.soft_penalties ?? { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0, S6: 0 };
  const priorityInversions = report?.bookings?.priority_inversions ?? [];
  const bookingScore = report?.bookings?.booking_score ?? 0;
  const bookingScoreMax = report?.bookings?.booking_score_max_if_all_approved ?? 0;
  const examSoftPenalty = report?.exam_soft_penalty ?? 0;

  return {
    report,
    isClean,
    hardCount,
    softTotal,
    softBreakdown,
    priorityInversions,
    bookingScore,
    bookingScoreMax,
    examSoftPenalty,
    stability: report?.stability
  };
}

