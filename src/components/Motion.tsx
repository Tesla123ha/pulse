import { LazyMotion, MotionConfig, domAnimation, m, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * One provider for the app. LazyMotion keeps the bundle small (only `m` components, no full `motion`),
 * and reducedMotion="user" drops movement and scaling for people who ask for less motion.
 */
export const MotionProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <LazyMotion features={domAnimation} strict>
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

/** Plays its StaggerItem descendants in sequence once, when first shown. */
export const Stagger: React.FC<{ children: ReactNode; className?: string }> = ({ children, className }) => (
  <m.div className={className} variants={group} initial="hidden" animate="show">
    {children}
  </m.div>
);

/** One block that fades and slides up as part of a Stagger. Add no styling of its own. */
export const StaggerItem: React.FC<{ children: ReactNode }> = ({ children }) => (
  <m.div variants={item}>{children}</m.div>
);
