/** Supabase currently issues eight-digit email OTPs, while older codes may be six digits. */
export const EMAIL_OTP_MIN_LENGTH = 6;
export const EMAIL_OTP_MAX_LENGTH = 8;
export const EMAIL_OTP_PATTERN = '[0-9]{6,8}';
export const EMAIL_OTP_PLACEHOLDER = '6- or 8-digit code';

export function isValidEmailOtp(value: string) {
  return new RegExp(`^${EMAIL_OTP_PATTERN}$`).test(value);
}
