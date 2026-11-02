export function validateReservationPeriod(startTime: unknown, endTime: unknown) {
  if (typeof startTime !== 'string' || typeof endTime !== 'string') {
    return null;
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return null;
  }

  return { start, end };
}

export function hasTimeConflict(
  newStart: Date,
  newEnd: Date,
  existingStart: Date,
  existingEnd: Date
) {
  return newStart < existingEnd && newEnd > existingStart;
}

export function canReserveSpot(active: boolean, hasConflict: boolean) {
  return active && !hasConflict;
}

export function validateExtensionEndTime(
  currentEnd: Date,
  newEndTime: unknown,
  now: Date
): Date | null {
  // TODO PRACTICE 2:
  // Determine whether the requested end time is a valid extension of the
  // current reservation. Return the parsed date only when it is valid.
  if (typeof newEndTime !== 'string' || !Number.isFinite(currentEnd.getTime()) ||
      !Number.isFinite(now.getTime()) || currentEnd <= now) {
    return null;
  }

  // The API contract requires an ISO date-time with an explicit time zone.
  const iso = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/i.exec(newEndTime);
  if (!iso) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = iso;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1] ||
      Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText ?? 0) > 59) {
    return null;
  }

  const newEnd = new Date(newEndTime);
  if (!Number.isFinite(newEnd.getTime()) || newEnd <= currentEnd) return null;
  return newEnd;
}
