/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Pulse is dark only */
import '@ionic/react/css/palettes/dark.always.css';

/* Theme: tokens first, then the Ionic mapping, then globals */
import './theme/fonts';
import './theme/tokens.css';
import './theme/ionic.css';
import './theme/global.css';

import { Redirect, Route, useLocation } from 'react-router-dom';
import { IonApp, IonRouterOutlet, IonTabs, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Kit from './pages/kit/Kit';
import KitHome from './pages/kit/KitHome';
import KitSession from './pages/kit/KitSession';
import KitFinish from './pages/kit/KitFinish';
import KitWorkouts from './pages/kit/KitWorkouts';
import KitProgress from './pages/kit/KitProgress';
import KitProfile from './pages/kit/KitProfile';
import Session from './pages/Session';
import Finish from './pages/Finish';
import LogWorkout from './pages/LogWorkout';
import Workouts from './pages/Workouts';
import Progress from './pages/Progress';
import Profile from './pages/Profile';
import Money from './pages/Money';
import { MotionProvider, renderBottomNav } from './components';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import ErrorBoundary from './components/ErrorBoundary';
import { supabase } from './lib/supabase';
import { SyncProvider } from './offline/SyncProvider';

setupIonicReact({ mode: 'ios' });

/** The five tab destinations with the bottom navigation. */
const Tabs: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/home">
          <Home />
        </Route>
        <Route exact path="/workouts">
          <Workouts />
        </Route>
        <Route exact path="/money">
          <Money />
        </Route>
        <Route exact path="/progress">
          <Progress />
        </Route>
        <Route exact path="/profile">
          <Profile />
        </Route>
      </IonRouterOutlet>
      {renderBottomNav(pathname)}
    </IonTabs>
  );
};

/** Signed out: only the auth screen exists; every other path redirects to it. */
const SignedOut: React.FC = () => (
  <IonRouterOutlet>
    <Route exact path="/auth">
      <Auth />
    </Route>
    <Route render={() => <Redirect to="/auth" />} />
  </IonRouterOutlet>
);

/** Session guard: routes below render only with a signed-in session. */
const Routes: React.FC = () => {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <SignedOut />;
  return (
    <SyncProvider>
      <SignedIn />
    </SyncProvider>
  );
};

/**
 * Dev-only component previews. Built as a plain array so production gets an
 * empty list: IonRouterOutlet crashes on false or null children.
 */
const DEV_ROUTES = import.meta.env.DEV
  ? [
      { path: '/kit', page: <Kit /> },
      { path: '/kit/home', page: <KitHome /> },
      { path: '/kit/session', page: <KitSession /> },
      { path: '/kit/finish', page: <KitFinish /> },
      { path: '/kit/workouts', page: <KitWorkouts /> },
      { path: '/kit/progress', page: <KitProgress /> },
      { path: '/kit/profile', page: <KitProfile /> },
    ].map(({ path, page }) => (
      <Route key={path} exact path={path}>
        {page}
      </Route>
    ))
  : [];

const SignedIn: React.FC = () => (
  <IonRouterOutlet>
    <Route exact path="/auth">
      <Redirect to="/home" />
    </Route>
    {/* Full-screen routes without the tab bar */}
    <Route exact path="/session">
      <Session />
    </Route>
    <Route exact path="/finish">
      <Finish />
    </Route>
    <Route exact path="/log-workout">
      <LogWorkout />
    </Route>
    {DEV_ROUTES}
    <Route exact path="/">
      <Redirect to="/home" />
    </Route>
    <Route path={['/home', '/workouts', '/money', '/progress', '/profile']}>
      <Tabs />
    </Route>
    <Route render={() => <Redirect to="/home" />} />
  </IonRouterOutlet>
);

const App: React.FC = () => (
  <IonApp>
    <ErrorBoundary
      onSignOut={() => {
        void supabase.auth.signOut().finally(() => window.location.assign('/auth'));
      }}
    >
      <MotionProvider>
        <AuthProvider>
          <IonReactRouter>
            <Routes />
          </IonReactRouter>
        </AuthProvider>
      </MotionProvider>
    </ErrorBoundary>
  </IonApp>
);

export default App;
