import { describe, expect, it } from 'vitest';
import { authMessage, cleanName, linkError, normalizeEmail, redirectUrl, validateEmail, validateNewPassword } from '../authValidation';

describe('email', () => {
  it('is trimmed and lower-cased', () => expect(normalizeEmail('  Me@Mail.COM ')).toBe('me@mail.com'));
  it.each(['', 'nope', 'a@b', 'a b@c.com', 'a@@b.com', `${'a'.repeat(250)}@b.com`])('rejects %s', (e) => {
    expect(validateEmail(e)).not.toBeNull();
  });
  it('accepts normal addresses', () => expect(validateEmail('me+pulse@mail.example.com')).toBeNull());
});

describe('new password', () => {
  it.each(['short1', 'onlyletterslong', '1234567890123'])('rejects %s', (p) => {
    expect(validateNewPassword(p)).not.toBeNull();
  });
  it('rejects more than 72 bytes', () => expect(validateNewPassword('a1'.repeat(40))).not.toBeNull());
  it('accepts a long mixed password and allows pasting spaces', () => {
    expect(validateNewPassword('correct horse battery 9')).toBeNull();
  });
});

describe('name', () => {
  it('collapses whitespace and limits length', () => {
    expect(cleanName('  Rob   ert ')).toBe('Rob ert');
    expect(cleanName('x'.repeat(200))).toHaveLength(60);
    expect(cleanName('   ')).toBeNull();
  });
});

describe('auth messages do not reveal accounts', () => {
  it('reads the same for a wrong password and an unknown email', () => {
    const wrong = authMessage({ code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 }, 'sign-in');
    const unknown = authMessage({ code: 'user_not_found', message: 'User not found', status: 400 }, 'sign-in');
    expect(wrong).toBe(unknown);
  });
  it('treats an existing email at sign-up as a normal success', () => {
    expect(authMessage({ code: 'user_already_exists', status: 422 }, 'sign-up')).toBeNull();
    expect(authMessage({ code: 'email_exists', status: 422 }, 'sign-up')).toBeNull();
  });
  it('never echoes the raw server message', () => {
    const m = authMessage({ message: 'duplicate key value violates unique constraint users_email_key', status: 500 }, 'sign-up');
    expect(m).not.toMatch(/duplicate|constraint|users_email_key/);
  });
  it('explains throttling and network loss', () => {
    expect(authMessage({ status: 429, code: 'over_email_send_rate_limit' }, 'reset-request')).toMatch(/too many/i);
    expect(authMessage({ name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }, 'sign-in')).toMatch(/connection/i);
  });
  it('explains an expired reset session', () => {
    expect(authMessage({ status: 401 }, 'reset-update')).toMatch(/expired/i);
  });
});

describe('links from email', () => {
  it('detects an expired link in the hash', () => {
    expect(linkError({ hash: '#error=access_denied&error_code=otp_expired&error_description=x', search: '' })).toMatch(/expired/i);
  });
  it('is quiet for a normal address', () => expect(linkError({ hash: '', search: '' })).toBeNull());
});

describe('redirect address', () => {
  it('uses the configured address first', () => expect(redirectUrl('https://x', true, 'https://pulse.example')).toBe('https://pulse.example'));
  it('uses the web origin on the web', () => expect(redirectUrl('https://pulse.example', false)).toBe('https://pulse.example'));
  it('leaves it to the project on Android, whose origin is internal', () => expect(redirectUrl('https://localhost', true)).toBeUndefined());
});
