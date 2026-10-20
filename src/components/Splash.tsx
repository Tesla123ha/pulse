import { m } from 'motion/react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';

/** Long enough for the icon and wordmark to read, short enough to never feel like a loading screen. */
const MIN_VISIBLE_MS = 900;

/** The splash plays once per launch, not again on sign-in, sign-out or navigation. */
let playedThisLaunch = false;

/**
 * In-app splash: matches the native launch screen, then fades out as soon as the stored
 * session has been read. It covers the app but never blocks it from starting up behind it.
 */
const Splash: React.FC = () => {
  const { loading } = useAuth();
  const [minElapsed, setMinElapsed] = useState(playedThisLaunch);
  const [gone, setGone] = useState(playedThisLaunch);

  useEffect(() => {
    if (playedThisLaunch) return;
    const t = window.setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, []);

  const leaving = !loading && minElapsed;
  if (gone) return null;

  return (
    <m.div
      className="splash"
      role="status"
      aria-label="Pulse is starting"
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      onAnimationComplete={() => {
        if (leaving) {
          playedThisLaunch = true;
          setGone(true);
        }
      }}
    >
      <div className="splash__stack">
        <m.img
          className="splash__mark"
          src="/pulse-mark.png"
          alt=""
          width={168}
          height={Math.round((168 * 245) / 480)}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />
        <m.div
          className="splash__text"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.18, ease: 'easeOut' }}
        >
          <span className="splash__word">Pulse</span>
          <span className="splash__tag">BUILD YOUR MOMENTUM.</span>
        </m.div>
      </div>
    </m.div>
  );
};

export default Splash;
