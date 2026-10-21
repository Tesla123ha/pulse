import { IonContent, IonInput, IonPage } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Segmented, Stagger, StaggerItem } from '../components';
import {
  authMessage,
  cleanName,
  linkError,
  normalizeEmail,
  redirectUrl,
  validateEmail,
  validateNewPassword,
  type AuthAction,
} from '../lib/authValidation';
import { supabase } from '../lib/supabase';
import { isOnline, onNetworkChange } from '../offline/network';
import './Auth.css';

const MODES = ['Sign in', 'Sign up'] as const;
type Mode = (typeof MODES)[number];

/** Email actions can be repeated at most this often, so the screen cannot be used to flood an inbox. */
const EMAIL_COOLDOWN_S = 60;

const Auth: React.FC = () => {
  const [mode, setMode] = useState<Mode>('Sign in');
  const [forgot, setForgot] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => linkError(window.location));
  const [note, setNote] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const inFlight = useRef(false);

  const [online, setOnline] = useState(isOnline());
  useEffect(() => onNetworkChange(setOnline), []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const signUp = mode === 'Sign up';
  const redirectTo = redirectUrl(window.location.origin, Capacitor.isNativePlatform(), import.meta.env.VITE_AUTH_REDIRECT_URL);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // One request at a time, even if the button is tapped twice before the screen updates
    if (inFlight.current || !online) return;
    setError(null);
    setNote(null);

    const cleanEmail = normalizeEmail(email);
    const emailProblem = validateEmail(cleanEmail);
    if (emailProblem) return setError(emailProblem);
    if (!forgot) {
      // Only new passwords are held to the rules; sign-in must accept whatever was set earlier.
      const passwordProblem = signUp ? validateNewPassword(password) : password ? null : 'Enter your password.';
      if (passwordProblem) return setError(passwordProblem);
    }
    if (forgot && cooldown > 0) return;

    inFlight.current = true;
    setBusy(true);
    const action: AuthAction = forgot ? 'reset-request' : signUp ? 'sign-up' : 'sign-in';
    try {
      if (forgot) {
        const { error: err } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
        // The same answer whether or not the address has an account, unless the request itself failed
        if (err && (err.status === 429 || err.status === 0 || /fetch|network/i.test(err.message))) {
          setError(authMessage(err, action));
        } else {
          setNote('If an account exists for that email, a reset link is on its way. Check your inbox.');
          setCooldown(EMAIL_COOLDOWN_S);
        }
      } else if (!signUp) {
        const { error: err } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (err) setError(authMessage(err, action));
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { display_name: cleanName(name) }, emailRedirectTo: redirectTo },
        });
        const message = err ? authMessage(err, action) : null;
        if (message) setError(message);
        else if (!data?.session) setNote('Check your email to confirm your account, then sign in.');
      }
    } catch (e2) {
      // A thrown error (offline, blocked request) must never leave the form stuck on "busy"
      setError(authMessage(e2 as { message?: string; name?: string }, action));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const showForm = (next: boolean) => {
    setForgot(next);
    setError(null);
    setNote(null);
    setPassword('');
  };

  const title = forgot ? 'Reset your password' : signUp ? 'Create your account' : 'Welcome back';

  return (
    <IonPage>
      <IonContent>
        <Stagger className="screen auth">
          <StaggerItem>
            <div>
              <p className="t-cap">Pulse</p>
              <h1 className="t-title-lg">{title}</h1>
            </div>
          </StaggerItem>

          {!forgot && (
            <StaggerItem>
              <Segmented label="Account" options={MODES} value={mode} onChange={(m) => { setMode(m); setError(null); setNote(null); }} />
            </StaggerItem>
          )}

          <StaggerItem>
            <form className="auth__form" onSubmit={submit} noValidate>
              {signUp && !forgot && (
                <label className="field">
                  <span className="field__label">Name</span>
                  <span className="field__control">
                    <IonInput
                      aria-label="Name"
                      autocomplete="name"
                      maxlength={60}
                      value={name}
                      onIonInput={(e) => setName(String(e.detail.value ?? ''))}
                    />
                  </span>
                </label>
              )}
              <label className="field">
                <span className="field__label">Email</span>
                <span className="field__control">
                  <IonInput
                    aria-label="Email"
                    type="email"
                    inputmode="email"
                    autocomplete="email"
                    autocapitalize="off"
                    maxlength={254}
                    value={email}
                    onIonInput={(e) => setEmail(String(e.detail.value ?? ''))}
                  />
                </span>
              </label>
              {!forgot && (
                <label className="field">
                  <span className="field__label">Password</span>
                  <span className="field__control">
                    <IonInput
                      aria-label="Password"
                      type="password"
                      autocomplete={signUp ? 'new-password' : 'current-password'}
                      value={password}
                      onIonInput={(e) => setPassword(String(e.detail.value ?? ''))}
                    />
                  </span>
                </label>
              )}
              {signUp && !forgot && <p className="auth__note">At least 10 characters, with letters and numbers.</p>}

              {!online && (
                <p className="auth__note" role="status">
                  You are offline. Connect to sign in.
                </p>
              )}
              {error && (
                <p className="auth__error" role="alert">
                  {error}
                </p>
              )}
              {note && (
                <p className="auth__note" role="status">
                  {note}
                </p>
              )}

              <Button variant="primary" size="lg" block type="submit" disabled={busy || !online || (forgot && cooldown > 0)}>
                {forgot ? (cooldown > 0 ? `Send again in ${cooldown}s` : 'Send reset link') : signUp ? 'Create account' : 'Sign in'}
              </Button>

              {!signUp && !forgot && (
                <Button variant="plain" block type="button" onClick={() => showForm(true)}>
                  Forgot password?
                </Button>
              )}
              {forgot && (
                <Button variant="plain" block type="button" onClick={() => showForm(false)}>
                  Back to sign in
                </Button>
              )}
            </form>
          </StaggerItem>
        </Stagger>
      </IonContent>
    </IonPage>
  );
};

export default Auth;
