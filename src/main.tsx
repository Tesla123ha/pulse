import React from 'react';
import { createRoot } from 'react-dom/client';
import './theme/tokens.css';
import './theme/global.css';

const root = createRoot(document.getElementById('root')!);

// App imports the Supabase client, which throws if env vars are missing.
// Load it dynamically so that error is shown on screen instead of a blank page.
import('./App')
  .then(({ default: App }) =>
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  )
  .catch((err: unknown) => {
    console.error(err);
    root.render(
      <main className="screen" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <h1 className="t-title-md">Pulse can't start</h1>
        <p className="t-secondary">{err instanceof Error ? err.message : String(err)}</p>
      </main>,
    );
  });
