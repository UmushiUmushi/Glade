// Slider: a value along a track, like the time of day. As in the design it is the browser's own
// range input (keyboard and screen readers work as people expect), in the text colour, with
// optional labels for its stops underneath.

import { useId } from "react";
import "./slider.css";

export interface SliderProps {
  /** Names the slider for screen readers: "Time of day". */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** What the value means, read out instead of the number: "Day, 12:00". */
  valueText?: (value: number) => string;
  /** Labels shown under the track, evenly spaced from min to max: Dawn, Day, Dusk, Night. */
  stops?: string[];
  /** Track width in CSS pixels. */
  width?: number;
}

export function Slider(props: SliderProps) {
  const id = useId();
  return (
    <div className="glade-slider" style={{ width: props.width ?? 184 }}>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        aria-label={props.label}
        aria-valuetext={props.valueText?.(props.value)}
        onChange={(e) => props.onChange(Number(e.currentTarget.value))}
      />
      {props.stops && (
        <div className="glade-slider-stops" aria-hidden="true">
          {props.stops.map((stop) => (
            <span key={stop}>{stop}</span>
          ))}
        </div>
      )}
    </div>
  );
}
