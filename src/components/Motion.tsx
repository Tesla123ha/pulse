import { useIonViewWillEnter } from '@ionic/react';
import {
  LazyMotion,
  MotionConfig,
  domMax,
  m,
  useAnimationControls,
  type HTMLMotionProps,
  type Variants,
} from 'motion/react';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * One provider for the app. LazyMotion keeps the bundle smaller (only `m` components, no full `motion`;
 * domMax adds layout animations for the sliding nav highlight), and reducedMotion="user" drops
 * movement and scaling for people who ask for less motion.
 */
export const MotionProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <LazyMotion features={domMax} strict>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </LazyMotion>
);

const group: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  // No bounce: Pulse is calm. Under reduced motion only the fade remains.
  show: { opacity: 1, y: 0, transition: { type: 'spring', visualDuration: 0.4, bounce: 0 } },
};

/**
 * Plays the entrance when first shown and again each time the person returns to the page.
 * Ionic keeps visited pages mounted, so mounting alone would only animate the first visit.
 */
function useReplayControls() {
  const controls = useAnimationControls();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    void controls.start('show');
    return () => {
      mounted.current = false;
    };
  }, [controls]);
  useIonViewWillEnter(() => {
    if (!mounted.current) return;
    controls.set('hidden');
    void controls.start('show');
  });
  return controls;
}

/** Plays its StaggerItem descendants in sequence on first show and on every return to the page. */
export const Stagger: React.FC<{ children: ReactNode; className?: string }> = ({ children, className }) => {
  const controls = useReplayControls();
  return (
    <m.div className={className} variants={group} initial="hidden" animate={controls}>
      {children}
    </m.div>
  );
};

/** One standalone block (a page title) that fades and slides up on first show and every return. */
export const Reveal: React.FC<{ children: ReactNode; className?: string }> = ({ children, className }) => {
  const controls = useReplayControls();
  return (
    <m.div className={className} variants={item} initial="hidden" animate={controls}>
      {children}
    </m.div>
  );
};

/** One block that fades and slides up as part of a Stagger. Add no styling of its own. */
export const StaggerItem: React.FC<{ children: ReactNode }> = ({ children }) => (
  <m.div variants={item}>{children}</m.div>
);

const SHEET_SPRING = { type: 'spring', visualDuration: 0.4, bounce: 0 } as const;

/** Dimmed backdrop that fades in. */
export const ScrimFade: React.FC<HTMLMotionProps<'div'>> = (props) => (
  <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} {...props} />
);

/** A bottom sheet that rises into place. Pass className, role and aria attributes as usual. */
export const SheetRise: React.FC<HTMLMotionProps<'div'>> = (props) => (
  <m.div initial={{ opacity: 0, y: 48 }} animate={{ opacity: 1, y: 0 }} transition={SHEET_SPRING} {...props} />
);
