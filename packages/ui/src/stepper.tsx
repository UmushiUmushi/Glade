// Stepper: a number with − and + buttons, like the builder's footprint width (1.5 tiles). From the
// design: one floating pill with two small round buttons and the value between them.

import { Button } from "react-aria-components";
import "./stepper.css";

export interface StepperProps {
  /** Names the group: "Width". */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Names for the two buttons: "Narrower", "Wider". */
  decrementLabel?: string;
  incrementLabel?: string;
  /** How the value is shown: "1.5". */
  format?: (value: number) => string;
}

/** A value moved by whole steps, kept inside min and max, without float drift (0.1 + 0.2). */
export function stepValue(value: number, by: number, min: number, max: number): number {
  const next = Math.round((value + by) * 1e6) / 1e6;
  return Math.min(max, Math.max(min, next));
}

export function Stepper(props: StepperProps) {
  const step = props.step ?? 1;
  const shown = props.format ? props.format(props.value) : String(props.value);
  return (
    <div className="glade-stepper" role="group" aria-label={props.label}>
      <Button
        className="glade-stepper-button"
        aria-label={props.decrementLabel ?? `Less ${props.label.toLowerCase()}`}
        isDisabled={props.value <= props.min}
        onPress={() => props.onChange(stepValue(props.value, -step, props.min, props.max))}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <path d="M6 12h12" />
        </svg>
      </Button>
      <output className="glade-stepper-value" aria-live="polite">
        {shown}
      </output>
      <Button
        className="glade-stepper-button"
        aria-label={props.incrementLabel ?? `More ${props.label.toLowerCase()}`}
        isDisabled={props.value >= props.max}
        onPress={() => props.onChange(stepValue(props.value, step, props.min, props.max))}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <path d="M12 6v12M6 12h12" />
        </svg>
      </Button>
    </div>
  );
}
