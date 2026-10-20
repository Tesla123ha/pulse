import { IonLabel, IonTabBar, IonTabButton } from '@ionic/react';
import { m } from 'motion/react';
import Icon, { type IconName } from './Icon';

export interface NavTab {
  tab: string;
  href: string;
  label: string;
  icon: IconName;
}

// One shared highlight slides from the old tab to the new one (layoutId). Reduced motion: it jumps.
const SLIDE = { type: 'spring', stiffness: 520, damping: 40 } as const;

export const NAV_TABS: NavTab[] = [
  { tab: 'home', href: '/home', label: 'Home', icon: 'home' },
  { tab: 'workouts', href: '/workouts', label: 'Workouts', icon: 'workouts' },
  { tab: 'money', href: '/money', label: 'Money', icon: 'wallet' },
  { tab: 'progress', href: '/progress', label: 'Progress', icon: 'progress' },
  { tab: 'profile', href: '/profile', label: 'Profile', icon: 'profile' },
];

/**
 * Builds the five-destination tab bar. Returned as an element (not a component)
 * because IonTabs requires IonTabBar as its direct child.
 */
export function renderBottomNav(currentPath: string) {
  return (
    <IonTabBar slot="bottom" className="pl-nav" aria-label="Primary">
      {NAV_TABS.map((t) => {
        const current = currentPath.startsWith(t.href);
        return (
          <IonTabButton key={t.tab} tab={t.tab} href={t.href} aria-current={current ? 'page' : undefined}>
            {current && (
              <>
                <m.span layoutId="nav-pill" className="pl-nav__pill" aria-hidden="true" transition={SLIDE} />
                <m.span layoutId="nav-marker" className="pl-nav__marker" aria-hidden="true" transition={SLIDE} />
              </>
            )}
            <span className="pl-nav__item">
              <Icon name={t.icon} />
              <IonLabel>{t.label}</IonLabel>
            </span>
          </IonTabButton>
        );
      })}
    </IonTabBar>
  );
}
