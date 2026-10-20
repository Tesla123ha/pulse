import { IonContent, IonInput, IonPage } from '@ionic/react';
import { useState, type FormEvent } from 'react';
import { Button, Segmented, Stagger, StaggerItem } from '../components';
import { supabase } from '../lib/supabase';
import './Auth.css';

const MODES = ['Sign in', 'Sign up'] as const;
type Mode = (typeof MODES)[number];

const Auth: React.FC = () => {
  const [mode, setMode] = useState<Mode>('Sign in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNote(null);
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    if (mode === 'Sign in') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name.trim() || null } },
      });
      if (err) setError(err.message);
      else if (!data.session) setNote('Check your email to confirm your account, then sign in.');
    }
    setBusy(false);
  };

  const signUp = mode === 'Sign up';

  return (
    <IonPage>
      <IonContent>
        <Stagger className="screen auth">
          <StaggerItem>
            <div>
              <p className="t-cap">Pulse</p>
              <h1 className="t-title-lg">{signUp ? 'Create your account' : 'Welcome back'}</h1>
            </div>
          </StaggerItem>

          <StaggerItem>
            <Segmented label="Account" options={MODES} value={mode} onChange={setMode} />
          </StaggerItem>

          <StaggerItem>
            <form className="auth__form" onSubmit={submit} noValidate>
              {signUp && (
                <label className="field">
                  <span className="field__label">Name</span>
                  <span className="field__control">
                    <IonInput
                      aria-label="Name"
                      autocomplete="name"
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
                    value={email}
                    onIonInput={(e) => setEmail(String(e.detail.value ?? ''))}
                  />
                </span>
              </label>
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

              <Button variant="primary" size="lg" block type="submit" disabled={busy}>
                {signUp ? 'Create account' : 'Sign in'}
              </Button>
            </form>
          </StaggerItem>
        </Stagger>
      </IonContent>
    </IonPage>
  );
};

export default Auth;
