import * as z from 'zod';

export const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;
export const UNICODE_NAME_REGEX = /^[\p{L}\p{M}\s\-'.()]+$/u;

export const indianPhoneSchema = z.string()
  .optional()
  .transform((val) => (val ? val.trim() : ''))
  .refine((val) => {
    if (!val) return true; // optional
    return /^\d+$/.test(val);
  }, { message: 'Mobile number must contain exactly 10 digits.' })
  .refine((val) => {
    if (!val) return true;
    return val.length === 10;
  }, { message: 'Mobile number must contain exactly 10 digits.' })
  .refine((val) => {
    if (!val) return true;
    return ['6', '7', '8', '9'].includes(val[0]);
  }, { message: 'Enter a valid Indian mobile number.' });

export const studentNameSchema = z.string()
  .transform((val) => val.trim())
  .refine((val) => val.length > 0, { message: 'Student name is required.' })
  .refine((val) => val.length >= 2, { message: 'Enter a name within the allowed length.' })
  .refine((val) => val.length <= 255, { message: 'Enter a name within the allowed length.' })
  .refine((val) => UNICODE_NAME_REGEX.test(val), { message: 'Enter a valid student name.' });

export const apaarIdSchema = z.string()
  .optional()
  .transform((val) => (val ? val.trim() : ''))
  .refine((val) => {
    if (!val) return true; // optional
    return /^\d+$/.test(val);
  }, { message: 'Enter digits only.' })
  .refine((val) => {
    if (!val) return true;
    return val.length === 12;
  }, { message: 'APAAR ID must contain exactly 12 digits.' });

export const emailSchema = z.string()
  .optional()
  .transform((val) => (val ? val.trim().toLowerCase() : ''))
  .refine((val) => {
    if (!val) return true; // optional
    return /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(val);
  }, { message: 'Enter a valid email address.' });

export const requiredEmailSchema = z.string()
  .transform((val) => val.trim().toLowerCase())
  .refine((val) => val.length > 0, { message: 'Email address is required.' })
  .refine((val) => /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(val), {
    message: 'Enter a valid email address.',
  });

export const dobSchema = z.string()
  .optional()
  .transform((val) => (val ? val.trim() : ''))
  .refine((val) => {
    if (!val) return true;
    const d = new Date(val);
    if (isNaN(d.getTime())) return false;
    // Check calendar validity (e.g. leap years)
    const [year, month, day] = val.split('-').map(Number);
    if (!year || !month || !day) return false;
    const parsed = new Date(year, month - 1, day);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  }, { message: 'Enter a valid calendar date (YYYY-MM-DD).' })
  .refine((val) => {
    if (!val) return true;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return new Date(val) <= today;
  }, { message: 'Date of birth cannot be in the future.' });

export const rollNumberSchema = z.string()
  .transform((val) => val.trim())
  .refine((val) => val.length > 0, { message: 'Roll number is required.' })
  .refine((val) => val.length <= 100, { message: 'Roll number cannot exceed 100 characters.' });

export const academicYearSchema = z.number()
  .min(2000, 'Select a valid academic year.')
  .max(2030, 'Select a valid academic year.');

export const courseIdSchema = z.number()
  .min(1, 'Select a valid course.');

export const intakeCapacitySchema = z.number()
  .int('Enter a valid whole-number intake capacity.')
  .min(1, 'Enter a valid whole-number intake capacity.')
  .max(1000, 'Intake capacity cannot exceed 1000 seats.');

/**
 * Sanitizes input text by extracting only digits up to maxLength.
 */
export function sanitizeDigitsOnly(val: string, maxLength: number = 10): string {
  return val.replace(/\D/g, '').slice(0, maxLength);
}
