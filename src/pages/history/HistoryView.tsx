import { IonInput } from '@ionic/react';
import { Button, Card, Icon, ListRow, Sheet } from '../../components';
import type { HistoryData, SessionDetail } from '../../data/history';
import { formatShortDate } from '../../lib/dates';
import { formatInt, plural } from '../../lib/format';
import { groupByMonth, type HistoryEntry } from '../../lib/history';
import { formatLoadTotal } from '../../lib/units';

export const PAGE = 30;

const caption = (e: HistoryEntry, units: 'metric' | 'imperial') =>
  [
    formatShortDate(new Date(e.endedAt)),
    e.durationMin > 0 && `${formatInt(e.durationMin)} min`,
    plural(e.setCount, 'set'),
    e.volumeKg > 0 && formatLoadTotal(e.volumeKg, units),
    e.status === 'ended_early' && 'Ended early',
  ]
    .filter(Boolean)
    .join(' · ');

export interface HistoryViewProps {
  data: HistoryData;
  /** Entries after the search filter, before paging. */
  filtered: HistoryEntry[];
  query: string;
  shown: number;
  open: HistoryEntry | null;
  detail: SessionDetail | null;
  detailError: string | null;
  onQuery: (q: string) => void;
  onMore: () => void;
  onOpen: (e: HistoryEntry) => void;
  onClose: () => void;
  onRepeat: (e: HistoryEntry) => void;
}

/** The list, search and detail sheet. Pure: everything comes from props. */
const HistoryView: React.FC<HistoryViewProps> = ({
  data,
  filtered,
  query,
  shown,
  open,
  detail,
  detailError,
  onQuery,
  onMore,
  onOpen,
  onClose,
  onRepeat,
}) => {
  const groups = groupByMonth(filtered.slice(0, shown));
  const blocked = data.openSession;
  return (
    <>
      {data.entries.length === 0 ? (
        <Card>
          <p className="t-title-sm">No finished workouts yet</p>
          <p className="t-cap">Finish a workout with at least one set and it appears here.</p>
          <Button variant="primary" style={{ marginTop: 'var(--space-3)' }} routerLink="/workouts">
            Choose a workout
          </Button>
        </Card>
      ) : (
        <>
          <label className="field__control workouts-search">
            <Icon name="search" />
            <IonInput
              aria-label="Search history by workout"
              placeholder="Search workouts"
              value={query}
              clearInput
              onIonInput={(e) => onQuery(String(e.detail.value ?? ''))}
            />
          </label>

          {filtered.length === 0 ? (
            <Card>
              <p className="t-title-sm">No workouts match</p>
              <p className="t-cap">Try another name.</p>
            </Card>
          ) : (
            groups.map((g) => (
              <section className="section" key={g.month} aria-label={g.month}>
                <h2 className="t-cap">{g.month}</h2>
                <div className="history-list">
                  {g.entries.map((e) => (
                    <ListRow
                      key={e.sessionId}
                      icon="workouts"
                      title={e.workoutName}
                      caption={caption(e, data.units)}
                      onClick={() => onOpen(e)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}

          {filtered.length > shown && (
            <Button variant="ghost" block onClick={onMore}>
              Show more ({filtered.length - shown} older)
            </Button>
          )}
        </>
      )}

      <Sheet isOpen={open !== null} onDismiss={onClose} labelledBy="history-detail-title">
        {open && (
          <>
            <div>
              <h2 id="history-detail-title" className="t-title-md">
                {open.workoutName}
              </h2>
              <p className="t-cap">{caption(open, data.units)}</p>
            </div>
            {detailError && (
              <p className="t-cap" role="alert" style={{ color: 'var(--danger)' }}>
                {detailError}
              </p>
            )}
            {!detail && !detailError && (
              <p className="t-cap" role="status">
                Loading sets
              </p>
            )}
            {detail?.exercises.map((ex) => (
              <div className="history-ex" key={ex.name}>
                <h3 className="t-title-sm">{ex.name}</h3>
                <ol className="history-sets">
                  {ex.sets.map((s) => (
                    <li key={s.number}>
                      <span className="t-cap">Set {s.number}</span>
                      <span>{s.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {detail?.notes && (
              <p className="t-cap">
                <strong>Notes:</strong> {detail.notes}
              </p>
            )}
            {blocked ? (
              <>
                <p className="t-cap">You have {blocked.workoutName} in progress. Finish it before starting another workout.</p>
                <Button variant="primary" size="lg" block routerLink="/session">
                  Resume {blocked.workoutName}
                </Button>
              </>
            ) : (
              <Button variant="primary" size="lg" block onClick={() => onRepeat(open)}>
                Repeat this workout
              </Button>
            )}
            <Button variant="ghost" block onClick={onClose}>
              Close
            </Button>
          </>
        )}
      </Sheet>
    </>
  );
};

export default HistoryView;
