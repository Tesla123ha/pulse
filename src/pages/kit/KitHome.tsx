import { IonContent, IonPage } from "@ionic/react";
import { useState } from "react";
import type { HomeData } from "../../data/home";
import type { ActivityMeta } from "../../lib/activity";
import type {
  ActivityLogRow,
  ActivityType,
  ProfileRow,
} from "../../lib/database.types";
import HomeView, { HomeHeader } from "../home/HomeView";
import QuickLogSheet from "../home/QuickLogSheet";
import "../Home.css";

// Dev-only: Home rendered with the artboard's sample values, to compare layout at 390px.
const profile: ProfileRow = {
  id: "kit",
  display_name: null,
  workouts_per_week: 4,
  move_goal_kcal: 600,
  calorie_goal: 2200,
  protein_goal_g: 140,
  carbs_goal_g: 240,
  fat_goal_g: 70,
  water_goal_glasses: 8,
  main_focus: "Build strength",
  units: "metric",
  reminders_enabled: true,
  created_at: "",
  updated_at: "",
};
const log = (
  type: ActivityType,
  duration_min: number,
  distance_km: number | null,
): ActivityLogRow => ({
  id: type,
  user_id: "kit",
  type,
  duration_min,
  distance_km,
  kcal: 0,
  logged_at: "",
  session_id: null,
});
const data: HomeData = {
  profile,
  week: [
    { letter: "W", name: "Wednesday", status: "done" },
    { letter: "T", name: "Thursday", status: "done" },
    { letter: "F", name: "Friday", status: "missed" },
    { letter: "S", name: "Saturday", status: "done" },
    { letter: "S", name: "Sunday", status: "done" },
    { letter: "M", name: "Monday", status: "done" },
    { letter: "T", name: "Tuesday", status: "today" },
  ],
  activeDays: 5,
  streak: 3,
  burnedKcal: 420,
  activeMin: 38,
  workout: {
    workoutId: "kit",
    name: "Upper Body Strength",
    durationMin: 45,
    level: "Intermediate",
    exerciseCount: 6,
    planWorkoutId: null,
    openSessionId: null,
  },
  lastByType: {
    run: log("run", 30, 5.2),
    lift: log("lift", 45, null),
    cycle: log("cycle", 40, 12),
    sport: log("sport", 60, null),
  },
  eatenKcal: 1420,
};

const KitHome: React.FC = () => {
  const [logging, setLogging] = useState<ActivityMeta | null>(null);
  return (
    <IonPage>
      <IonContent>
        <div className="screen">
          <HomeHeader today={new Date(2026, 9, 13)} />
          <HomeView data={data} onLog={setLogging} />
        </div>
        <QuickLogSheet
          activity={logging}
          last={logging ? data.lastByType[logging.type] : undefined}
          units="metric"
          onDismiss={() => setLogging(null)}
          onSave={async () => setLogging(null)}
        />
      </IonContent>
    </IonPage>
  );
};

export default KitHome;
