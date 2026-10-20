import type { LoadChoice } from '../lib/load';
import { getDb } from '../offline/db';
import { localWrite } from '../offline/outbox';

/** The weight unit the user chose for each exercise, by exercise id. */
export async function loadLoadPrefs(): Promise<Record<string, LoadChoice>> {
  const rows = await getDb().exercise_load_prefs.toArray();
  return Object.fromEntries(rows.map((r) => [r.exercise_id, r.unit]));
}

/** Remembers the unit for one exercise; synced to the user's other devices. */
export async function setLoadPref(exerciseId: string, choice: LoadChoice): Promise<void> {
  const db = getDb();
  // The local database is named for its owner: pulse-<user id>.
  const userId = db.name.replace(/^pulse-/, '');
  await localWrite(db, ['exercise_load_prefs'], (w) =>
    w.upsert('exercise_load_prefs', {
      user_id: userId,
      exercise_id: exerciseId,
      unit: choice,
      updated_at: new Date().toISOString(),
    }),
  );
}
