import { useState, useCallback } from 'react';
import { AIParseResult, BookingRequest } from '../core/types';
import { parseBookingAI, submitBooking as apiSubmitBooking } from '../core/api';

export function useBookingParser(onBookingCreated?: () => void) {
  const [inputText, setInputText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseResult, setParseResult] = useState<AIParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Editable Form Fields (allows manual editing and override fallback)
  const [title, setTitle] = useState('');
  const [attendance, setAttendance] = useState<number>(50);
  const [durationPeriods, setDurationPeriods] = useState<number>(1);
  const [day, setDay] = useState('MON');
  const [fromPeriod, setFromPeriod] = useState<number>(10);
  const [toPeriod, setToPeriod] = useState<number>(11);
  const [roomTypes, setRoomTypes] = useState<string[]>(['seminar_hall']);
  const [needs, setNeeds] = useState<string[]>([]);
  const [requestedRoom, setRequestedRoom] = useState<string>('');
  const [requestedCategory, setRequestedCategory] = useState<string>('club_event');
  const [recurrence, setRecurrence] = useState<'once' | 'recurring'>('once');
  const [targetWeek, setTargetWeek] = useState<number | null>(7);
  const [roomWarning, setRoomWarning] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);

  const parseText = useCallback(async (customText?: string) => {
    const textToParse = customText || inputText;
    if (!textToParse.trim()) return;

    setIsParsing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await parseBookingAI(textToParse);
      setParseResult(res);

      // Pre-fill editable form fields
      setTitle(textToParse.slice(0, 50));
      if (res.attendance) setAttendance(res.attendance);
      if (res.duration_periods) setDurationPeriods(res.duration_periods);
      if (res.windows && res.windows.length > 0) {
        setDay(res.windows[0].day);
        setFromPeriod(res.windows[0].from_period);
        setToPeriod(res.windows[0].to_period);
      }
      if (res.room_types && res.room_types.length > 0) {
        setRoomTypes(res.room_types);
      }
      setNeeds(res.needs || []);
      setRequestedRoom(res.requested_room || '');
      setRequestedCategory(res.requested_category || 'club_event');
      if (res.recurrence) setRecurrence(res.recurrence);
      if (res.target_week !== undefined && res.target_week !== null) setTargetWeek(res.target_week);
      setRoomWarning(res.room_warning || null);
      setFollowUp(res.follow_up || null);

      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to parse natural language request');
    } finally {
      setIsParsing(false);
    }
  }, [inputText]);

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const computedWeekScope = recurrence === 'once' ? (targetWeek === 7 ? 'spectra' : 'normal') : 'normal';
      const payload: Partial<BookingRequest> = {
        title: title || 'Campus Venue Request',
        attendance: Number(attendance) || 50,
        duration_periods: Number(durationPeriods) || 1,
        windows: [{ day, from_period: Number(fromPeriod), to_period: Number(toPeriod) }],
        room_types: roomTypes,
        needs,
        requested_room: requestedRoom.trim() ? requestedRoom.trim() : null,
        requested_category: requestedCategory,
        raw_text: inputText || title,
        recurrence,
        target_week: recurrence === 'once' ? (targetWeek ?? 7) : null,
        week_scope: computedWeekScope
      };
      const res = await apiSubmitBooking(payload);
      const queueName = computedWeekScope === 'spectra' ? 'Spectra Fest Week 7' : (recurrence === 'recurring' ? 'Normal Teaching Weeks (Recurring)' : `Normal Teaching Week ${targetWeek}`);
      setSuccessMessage(`Booking request ${res.booking.id} created and queued into ${queueName} successfully!`);
      if (onBookingCreated) onBookingCreated();
      return res;
    } catch (err: any) {
      setError(err.message || 'Failed to submit booking');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [title, attendance, durationPeriods, day, fromPeriod, toPeriod, roomTypes, needs, requestedRoom, requestedCategory, inputText, recurrence, targetWeek, onBookingCreated]);

  return {
    inputText,
    setInputText,
    isParsing,
    isSubmitting,
    parseResult,
    error,
    successMessage,
    parseText,
    submit,
    // Form fields
    title, setTitle,
    attendance, setAttendance,
    durationPeriods, setDurationPeriods,
    day, setDay,
    fromPeriod, setFromPeriod,
    toPeriod, setToPeriod,
    roomTypes, setRoomTypes,
    needs, setNeeds,
    requestedRoom, setRequestedRoom,
    requestedCategory, setRequestedCategory,
    recurrence, setRecurrence,
    targetWeek, setTargetWeek,
    roomWarning,
    followUp
  };
}

