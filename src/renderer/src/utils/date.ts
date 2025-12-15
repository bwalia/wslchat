/**
 * Date utilities for handling various date formats from the API
 */

/**
 * Safely parse a date string from the API
 * Handles PostgreSQL timestamp format (2025-11-28 08:32:57) and ISO format
 * @param dateString - The date string to parse
 * @returns A valid Date object (falls back to current date if invalid)
 */
export const parseApiDate = (dateString: string | undefined | null): Date => {
  if (!dateString) {
    return new Date();
  }

  // If it doesn't have 'T', it's likely PostgreSQL format - convert to ISO
  let normalized = dateString;
  if (typeof dateString === 'string' && !dateString.includes('T')) {
    // Replace space with 'T' and add 'Z' for UTC if no timezone
    normalized = dateString.replace(' ', 'T');
    if (!normalized.includes('+') && !normalized.includes('Z')) {
      normalized += 'Z';
    }
  }

  const date = new Date(normalized);

  // If still invalid, return current date as fallback
  if (isNaN(date.getTime())) {
    console.warn('[parseApiDate] Invalid date:', dateString);
    return new Date();
  }

  return date;
};

/**
 * Check if a date string is valid
 * @param dateString - The date string to check
 * @returns True if the date is valid
 */
export const isValidDate = (dateString: string | undefined | null): boolean => {
  if (!dateString) {
    return false;
  }

  const date = parseApiDate(dateString);
  return !isNaN(date.getTime());
};
