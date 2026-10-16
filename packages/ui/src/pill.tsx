// Pills. Pill: a small dark label that says something (60 FPS, the coordinates). Chip: a small
// round toggle, on or off (the filter's Sittable, Wood, a pack), shown with aria-pressed.

import type { ReactNode } from "react";
import { ToggleButton } from "react-aria-components";
import "./pill.css";

export function Pill(props: { children: ReactNode; "aria-label"?: string }) {
  return (
    <span className="glade-pill" aria-label={props["aria-label"]}>
      {props.children}
    </span>
  );
}

export interface ChipProps {
  children: string;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
}

export function Chip(props: ChipProps) {
  return (
    <ToggleButton
      className="glade-chip"
      isSelected={props.selected}
      onChange={props.onSelectedChange}
    >
      {props.children}
    </ToggleButton>
  );
}
