import { IonTextarea } from '@ionic/react';
import { useEffect, useState } from 'react';
import { Button, Sheet } from '../../components';

export interface NoteSheetProps {
  isOpen: boolean;
  initial: string;
  onDismiss: () => void;
  onSave: (notes: string) => Promise<void>;
}

/** Free-text note on the workout session. */
const NoteSheet: React.FC<NoteSheetProps> = ({ isOpen, initial, onDismiss, onSave }) => {
  const [text, setText] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (isOpen) setText(initial);
  }, [isOpen, initial]);

  return (
    <Sheet isOpen={isOpen} onDismiss={onDismiss} labelledBy="note-title">
      <h2 id="note-title" className="t-title-md">
        Workout note
      </h2>
      <label className="field">
        <span className="field__label">Saved with this workout</span>
        <span className="field__control field__control--area">
          <IonTextarea
            aria-label="Workout note"
            autoGrow
            rows={3}
            maxlength={1000}
            value={text}
            onIonInput={(e) => setText(String(e.detail.value ?? ''))}
          />
        </span>
      </label>
      <div className="section">
        <Button
          variant="primary"
          size="lg"
          block
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(text);
            } finally {
              setSaving(false);
            }
          }}
        >
          Save note
        </Button>
        <Button variant="ghost" block onClick={onDismiss}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
};

export default NoteSheet;
