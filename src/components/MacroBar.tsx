import ProgressBar from './ProgressBar';

export type Macro = 'protein' | 'carbs' | 'fat';

const names: Record<Macro, string> = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' };

export interface MacroBarProps {
  macro: Macro;
  current: number;
  target: number;
}

/** One macro: label, value / target, and a bar in that macro's data color. */
const MacroBar: React.FC<MacroBarProps> = ({ macro, current, target }) => (
  <div className="pl-macro">
    <div className="pl-macro__name">{names[macro]}</div>
    <div className="pl-macro__val">
      {Math.round(current)} / {Math.round(target)} g
    </div>
    <ProgressBar
      value={target > 0 ? current / target : 0}
      label={`${names[macro]}: ${Math.round(current)} of ${Math.round(target)} grams`}
      color={`var(--data-${macro})`}
    />
  </div>
);

export default MacroBar;
