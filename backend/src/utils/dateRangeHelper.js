/**
 * Helper to compute date boundaries for current and previous comparison periods.
 */

export function parseDateRange(query = {}) {
  const range = (query.range || query.period || "30d").toLowerCase();
  const now = new Date();

  let start = new Date(now);
  let end = new Date(now);
  let prevStart = new Date(now);
  let prevEnd = new Date(now);
  let interval = query.interval || "day"; // "day", "week", "month", "year"

  // Standardize end to end of day unless specified
  end.setUTCHours(23, 59, 59, 999);

  switch (range) {
    case "today": {
      start.setUTCHours(0, 0, 0, 0);

      prevStart = new Date(start);
      prevStart.setUTCDate(prevStart.getUTCDate() - 1);
      prevEnd = new Date(end);
      prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);

      interval = query.interval || "hour";
      break;
    }

    case "yesterday": {
      start.setUTCDate(start.getUTCDate() - 1);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCDate(end.getUTCDate() - 1);
      end.setUTCHours(23, 59, 59, 999);

      prevStart = new Date(start);
      prevStart.setUTCDate(prevStart.getUTCDate() - 1);
      prevEnd = new Date(end);
      prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);

      interval = query.interval || "hour";
      break;
    }

    case "7d":
    case "last_7_days":
    case "last7days": {
      start.setUTCDate(start.getUTCDate() - 6);
      start.setUTCHours(0, 0, 0, 0);

      const spanMs = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - spanMs);

      interval = query.interval || "day";
      break;
    }

    case "30d":
    case "last_30_days":
    case "last30days": {
      start.setUTCDate(start.getUTCDate() - 29);
      start.setUTCHours(0, 0, 0, 0);

      const spanMs = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - spanMs);

      interval = query.interval || "day";
      break;
    }

    case "this_month":
    case "thismonth": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

      // Previous period: last month
      prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
      prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));

      interval = query.interval || "day";
      break;
    }

    case "last_month":
    case "lastmonth": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));

      // Previous period: two months ago
      prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1, 0, 0, 0, 0));
      prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 0, 23, 59, 59, 999));

      interval = query.interval || "day";
      break;
    }

    case "this_year":
    case "thisyear": {
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));

      // Previous period: last year
      prevStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1, 0, 0, 0, 0));
      prevEnd = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31, 23, 59, 59, 999));

      interval = query.interval || "month";
      break;
    }

    case "custom": {
      if (query.startDate || query.from) {
        start = new Date(query.startDate || query.from);
        if (isNaN(start.getTime())) start = new Date(now.getTime() - 30 * 86400000);
        else start.setUTCHours(0, 0, 0, 0);
      } else {
        start.setUTCDate(start.getUTCDate() - 29);
        start.setUTCHours(0, 0, 0, 0);
      }

      if (query.endDate || query.to) {
        end = new Date(query.endDate || query.to);
        if (isNaN(end.getTime())) end = new Date(now);
        else end.setUTCHours(23, 59, 59, 999);
      } else {
        end.setUTCHours(23, 59, 59, 999);
      }

      const spanMs = Math.max(end.getTime() - start.getTime(), 86400000);
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - spanMs);

      // Choose interval based on duration
      const days = spanMs / 86400000;
      if (days <= 2) interval = query.interval || "hour";
      else if (days <= 60) interval = query.interval || "day";
      else if (days <= 180) interval = query.interval || "week";
      else interval = query.interval || "month";
      break;
    }

    default: {
      // Default to 30d
      start.setUTCDate(start.getUTCDate() - 29);
      start.setUTCHours(0, 0, 0, 0);

      const spanMs = end.getTime() - start.getTime();
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - spanMs);
      interval = query.interval || "day";
      break;
    }
  }

  return {
    range,
    start,
    end,
    prevStart,
    prevEnd,
    interval,
  };
}

/**
 * Calculates percentage growth between two periods.
 * Returns signed number rounded to 1 decimal place.
 */
export function calculateGrowth(current = 0, previous = 0) {
  if (previous === 0) {
    if (current > 0) return 100;
    if (current < 0) return -100;
    return 0;
  }
  const growth = ((current - previous) / Math.abs(previous)) * 100;
  return Math.round(growth * 10) / 10;
}

