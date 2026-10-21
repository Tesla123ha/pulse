/** Input rules and safe messages for the sign-in, sign-up and password-reset screens. */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72; // bcrypt, used by Supabase Auth, ignores bytes past 72
export const NAME_MAX = 60;
const EMAIL_MAX = 254;

/** Lower-cased and trimmed, so "  Me@Mail.COM " and "me@mail.com" are the same account. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  if (!email) return 'Enter your email.';
  if (email.length > EMAIL_MAX || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'Enter a valid email address.';
  return null;
}

export function validateNewPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Mix letters and numbers.';
  return null;
}

export function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return name || null;
}

interface AuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

export type AuthAction = 'sign-in' | 'sign-up' | 'reset-request' | 'reset-update';

/**
 * Turns a Supabase Auth error into text that is safe to show: no account enumeration
 * (a wrong password and an unknown email read the same), no raw server messages.
 * Returns null when the error should look like success (an already-registered email).
 */
export function authMessage(error: AuthErrorLike, action: AuthAction): string | null {
  const code = error.code ?? '';
  const text = `${error.name ?? ''} ${error.message ?? ''}`;
  if (error.status === 429 || /rate_limit|over_.*_limit|too many/i.test(`${code} ${text}`)) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (/AuthRetryableFetchError|failed to fetch|network|load failed/i.test(text) || error.status === 0) {
    return 'Could not reach Pulse. Check your connection and try again.';
  }
  if (action === 'sign-in') {
    if (code === 'email_not_confirmed') return 'Confirm your email first. Check your inbox for the link.';
    return 'Email or password is incorrect.';
  }
  if (action === 'sign-up') {
    if (code === 'user_already_exists' || code === 'email_exists') return null;
    if (code === 'weak_password') return 'That password is too easy to guess. Try a longer one.';
    return 'Could not create the account. Check your details and try again.';
  }
  if (action === 'reset-update') {
    if (code === 'same_password') return 'Choose a password you have not used before.';
    if (code === 'weak_password') return 'That password is too easy to guess. Try a longer one.';
    if (code === 'reauthentication_needed' || error.status === 401 || error.status === 403) {
      return 'This reset link has expired. Request a new one.';
    }
    return 'Could not update the password. Try again.';
  }
  return 'Could not send the reset email. Try again in a minute.';
}

/** Reads an auth error that Supabase put in the page address (expired or already used link). */
export function linkError(url: { hash: string; search: string }): string | null {
  const params = new URLSearchParams(url.hash.replace(/^#/, '') || url.search);
  const code = params.get('error_code') ?? params.get('error');
  if (!code) return null;
  if (code === 'otp_expired' || code === 'access_denied') return 'That link has expired or was already used. Request a new one.';
  return 'That link did not work. Request a new one.';
}

/**
 * Where emails send people back to. The address must also be allowed under Authentication > URL
 * Configuration in Supabase. In the Android app the page address is internal, so an email link
 * cannot open it: use the configured public address, or leave it to the project's Site URL.
 */
export function redirectUrl(origin: string, native: boolean, configured?: string): string | undefined {
  if (configured) return configured;
  return native ? undefined : origin;
}
