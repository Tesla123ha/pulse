import { IonLabel, IonTabBar, IonTabButton } from '@ionic/react';
import Icon, { type IconName } from './Icon';

export interface NavTab {
  tab: string;
  href: string;
  label: string;
  icon: IconName;
}

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
            <span className="pl-nav__marker" aria-hidden="true" />
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
