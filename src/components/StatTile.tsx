export interface StatTileProps {
  /** Specific label: "Burned", "Distance". Never a bare "Calories". */
  label: string;
  value: string;
  unit?: string;
  /** Progress delta, shown in lime. */
  delta?: string;
  /** Sits inside a raised sheet (surface-overlay fill). */
  overlay?: boolean;
}

const StatTile: React.FC<StatTileProps> = ({ label, value, unit, delta, overlay }) => (
  <div className={`pl-stat${overlay ? ' pl-stat--overlay' : ''}`}>
    <div className="pl-stat__label">{label}</div>
    <div className="pl-stat__value">
      {value}
      {unit && <span className="pl-stat__unit">{unit}</span>}
    </div>
    {delta && <div className="pl-stat__delta">{delta}</div>}
  </div>
);

export default StatTile;
