import { IonContent, IonInput, IonPage } from '@ionic/react';
import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Button, Stagger, StaggerItem } from '../components';
import { authMessage, validateNewPassword } from '../lib/authValidation';
import { supabase } from '../lib/supabase';
import './Auth.css';

/** Shown after a password-reset email link is opened, before the app: the person picks a new password. */
const ResetPassword: React.FC = () => {
  const { session, finishRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  // No session means the link was expired, used already or opened somewhere else.
  const linkUsable = Boolean(session);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    setError(null);
    const problem = validateNewPassword(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('The two passwords do not match.');
    inFlight.current = true;
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) setError(authMessage(err, 'reset-update'));
      else finishRecovery();
    } catch (e2) {
      setError(authMessage(e2 as { message?: string }, 'reset-update'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const requestNewLink = () => {
    // Leaves the reset step; the sign-in screen has the "Forgot password" option.
    void signOut();
    finishRecovery();
  };

  return (
    <IonPage>
      <IonContent>
        <Stagger className="screen auth">
          <StaggerItem>
            <div>
              <p className="t-cap">Pulse</p>
              <h1 className="t-title-lg">Choose a new password</h1>
            </div>
          </StaggerItem>
          <StaggerItem>
            {linkUsable ? (
              <form className="auth__form" onSubmit={submit} noValidate>
                <label className="field">
                  <span className="field__label">New password</span>
                  <span className="field__control">
                    <IonInput
                      aria-label="New password"
                      type="password"
                      autocomplete="new-password"
                      value={password}
                      onIonInput={(e) => setPassword(String(e.detail.value ?? ''))}
                    />
                  </span>
                </label>
                <label className="field">
                  <span className="field__label">Repeat the password</span>
                  <span className="field__control">
                    <IonInput
                      aria-label="Repeat the password"
                      type="password"
                      autocomplete="new-password"
                      value={confirm}
                      onIonInput={(e) => setConfirm(String(e.detail.value ?? ''))}
                    />
                  </span>
                </label>
                <p className="auth__note">At least 10 characters, with letters and numbers.</p>
                {error && (
                  <p className="auth__error" role="alert">
                    {error}
                  </p>
                )}
                <Button variant="primary" size="lg" block type="submit" disabled={busy}>
                  Save password
                </Button>
              </form>
            ) : (
              <div className="auth__form">
                <p className="auth__error" role="alert">
                  This reset link has expired or was already used.
                </p>
                <Button variant="primary" size="lg" block onClick={requestNewLink}>
                  Request a new link
                </Button>
              </div>
            )}
          </StaggerItem>
        </Stagger>
      </IonContent>
    </IonPage>
  );
};

export default ResetPassword;
