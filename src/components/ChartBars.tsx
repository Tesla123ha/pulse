export interface ChartBar {
  /** Axis label, e.g. "W". */
  label: string;
  /** Full label for the accessible summary, e.g. "Wednesday". */
  name: string;
  value: number;
}

export interface ChartBarsProps {
  bars: ChartBar[];
  /** Index of the current period (drawn in accent, value printed above). */
  currentIndex: number;
  goal?: number;
  /** Formats values for the printed value and the accessible summary. */
  format: (v: number) => string;
  /** Prefix for the accessible summary, e.g. "Active minutes per day this week". */
  summary: string;
  height?: number;
}

const AXIS = 24; // label line (16px) + gap (8px)

/** Seven-bar chart. Past bars in chart-bar, the current bar in accent, dashed goal line. */
const ChartBars: React.FC<ChartBarsProps> = ({ bars, currentIndex, goal, format, summary, height = 104 }) => {
  const plot = height - AXIS - 18; // leave room for the value above the current bar
  const max = Math.max(goal ?? 0, ...bars.map((b) => b.value), 1);
  const px = (v: number) => Math.max(4, Math.round((v / max) * plot));
  const a11y =
    `${summary}: ` +
    bars.map((b) => `${b.name} ${format(b.value)}`).join(', ') +
    (goal ? `. Goal ${format(goal)}.` : '.');

  return (
    <div className="pl-chart" style={{ height }} role="img" aria-label={a11y}>
      {goal ? <div className="pl-chart__goal" aria-hidden="true" style={{ bottom: AXIS + px(goal) - 1 }} /> : null}
      <div className="pl-chart__cols" aria-hidden="true">
        {bars.map((b, i) => {
          const now = i === currentIndex;
          return (
            <div className="pl-chart__col" key={i}>
              {now && <span className="pl-chart__value">{format(b.value)}</span>}
              <div className={`pl-chart__bar${now ? ' pl-chart__bar--now' : ''}`} style={{ height: px(b.value) }} />
              <span className={`pl-chart__axis${now ? ' pl-chart__axis--now' : ''}`}>{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChartBars;
