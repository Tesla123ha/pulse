import { Button, Card, Icon, Toggle, type IconName } from '../../components';
import type { Achievement, ProfileData } from '../../data/profile';
import { GOAL_ROWS, memberSince, unitsText, type EditField } from '../../lib/profile';

const ACHIEVEMENT_ICONS: IconName[] = ['bolt', 'run', 'workouts', 'swim', 'pickleball', 'tennis'];
const achievementIcon = (name: string): IconName =>
  (ACHIEVEMENT_ICONS as string[]).includes(name) ? (name as IconName) : 'bolt';

export interface ProfileViewProps {
  data: ProfileData;
  version: string;
  busy: boolean;
  onEdit: (field: EditField) => void;
  onReminders: (on: boolean) => void;
  onPrivacy: () => void;
  onSignOut: () => void;
}

const Badge: React.FC<{ a: Achievement }> = ({ a }) =>
  a.earnedAt ? (
    <li className="badge badge--earned" aria-label={`${a.name}, earned`}>
      <span className="badge__icon">
        <Icon name={achievementIcon(a.icon)} />
      </span>
      <span className="badge__name">{a.name}</span>
    </li>
  ) : (
    <li className="badge badge--locked" aria-label={`${a.name}, locked. ${a.description}`}>
      <span className="badge__icon">
        <Icon name="lock" />
      </span>
      <span className="badge__name">{a.name}</span>
      <span className="badge__state">Locked</span>
    </li>
  );

/** Profile, goals, achievements and settings. Pure: everything comes from props. */
const ProfileView: React.FC<ProfileViewProps> = ({
  data,
  version,
  busy,
  onEdit,
  onReminders,
  onPrivacy,
  onSignOut,
}) => {
  const { profile, achievements } = data;
  const earned = achievements.filter((a) => a.earnedAt).length;
  const name = profile.display_name?.trim() || data.email;

  return (
    <>
      <div className="split">
        <div className="split__col">
          <div className="row profile-head">
            <div className="profile-avatar">
              <Icon name="profile" size={32} label="Profile photo placeholder" />
            </div>
            <div className="grow">
              <h1 className="t-title-md profile-name">{name}</h1>
              <div className="t-cap">{memberSince(profile.created_at)}</div>
            </div>
            <Button iconOnly aria-label="Edit name" onClick={() => onEdit('display_name')}>
              <Icon name="pencil" />
            </Button>
          </div>

          <section className="section" aria-labelledby="goals-title">
            <div className="sec-head">
              <h2 id="goals-title" className="t-title-sm">
                My goals
              </h2>
              <span className="t-cap">Tap a goal to edit</span>
            </div>
            <Card flush>
              {GOAL_ROWS.map((g) => (
                <button key={g.field} type="button" className="prow" onClick={() => onEdit(g.field)}>
                  <span className="t-secondary">{g.label}</span>
                  <span className="pval">
                    {g.value(profile)}
                    <Icon name="chevronRight" size={20} />
                  </span>
                </button>
              ))}
            </Card>
          </section>

          {achievements.length > 0 && (
            <section className="section" aria-labelledby="achievements-title">
              <div className="sec-head">
                <h2 id="achievements-title" className="t-title-sm">
                  Achievements
                </h2>
                <span className="t-cap">
                  {earned} of {achievements.length} earned
                </span>
              </div>
              <ul className="badges">
                {achievements.map((a) => (
                  <Badge key={a.id} a={a} />
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="split__col">
          <section className="section" aria-labelledby="settings-title">
            <h2 id="settings-title" className="t-title-sm">
              Settings
            </h2>
            <Card flush>
              <div className="prow prow--static">
                <Toggle label="Workout reminders" checked={profile.reminders_enabled} onChange={onReminders} />
              </div>
              <button type="button" className="prow" onClick={() => onEdit('units')}>
                <span>Units</span>
                <span className="pval pval--quiet">
                  {unitsText(profile.units)}
                  <Icon name="chevronRight" size={20} />
                </span>
              </button>
              <button type="button" className="prow" onClick={onPrivacy}>
                <span>Privacy and data</span>
                <span className="pval">
                  <Icon name="chevronRight" size={20} />
                </span>
              </button>
            </Card>
          </section>

          <section className="section">
            <Button variant="ghost" block disabled={busy} onClick={onSignOut}>
              Sign out
            </Button>
            <p className="t-cap t-muted profile-version">Version {version}</p>
          </section>
        </div>
      </div>
    </>
  );
};

export default ProfileView;
