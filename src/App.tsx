import { Redirect, Route, useLocation } from 'react-router-dom';
import { IonApp, IonRouterOutlet, IonTabs, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Kit from './pages/Kit';
import Placeholder from './pages/Placeholder';
import { renderBottomNav } from './components';
import { AuthProvider, useAuth } from './auth/AuthProvider';

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
          <Placeholder title="Workouts" />
        </Route>
        <Route exact path="/nutrition">
          <Placeholder title="Nutrition" />
        </Route>
        <Route exact path="/progress">
          <Placeholder title="Progress" />
        </Route>
        <Route exact path="/profile">
          <Placeholder title="Profile" showSignOut />
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
  return session ? <SignedIn /> : <SignedOut />;
};

const SignedIn: React.FC = () => (
  <IonRouterOutlet>
    <Route exact path="/auth">
      <Redirect to="/home" />
    </Route>
    {/* Full-screen routes without the tab bar */}
    <Route exact path="/session">
      <Placeholder title="Workout session" />
    </Route>
    <Route exact path="/finish">
      <Placeholder title="Finish workout" />
    </Route>
    {import.meta.env.DEV && (
      <Route exact path="/kit">
        <Kit />
      </Route>
    )}
    <Route exact path="/">
      <Redirect to="/home" />
    </Route>
    <Route path={['/home', '/workouts', '/nutrition', '/progress', '/profile']}>
      <Tabs />
    </Route>
    <Route render={() => <Redirect to="/home" />} />
  </IonRouterOutlet>
);

const App: React.FC = () => (
  <IonApp>
    <AuthProvider>
      <IonReactRouter>
        <Routes />
      </IonReactRouter>
    </AuthProvider>
  </IonApp>
);

export default App;
