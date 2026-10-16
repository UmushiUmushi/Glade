// Checkbox: the design's tick box (Snow, Ruler, Always on). A 24 px rounded box that fills with the
// selected colour and shows a tick, so "on" never depends on colour alone.

import type { ReactNode } from "react";
import {
  Checkbox as AriaCheckbox,
  type CheckboxProps as AriaCheckboxProps,
} from "react-aria-components";
import { Icon, type IconId } from "./icons";
import "./checkbox.css";

export interface CheckboxProps extends Omit<AriaCheckboxProps, "children" | "className" | "style"> {
  /** The visible label. */
  children: ReactNode;
  /** An icon between the box and the label (Snow has a snowflake). */
  icon?: IconId;
}

export function Checkbox({ children, icon, ...rest }: CheckboxProps) {
  return (
    <AriaCheckbox {...rest} className="glade-checkbox">
      {({ isSelected }) => (
        <>
          <span className="glade-checkbox-box" aria-hidden="true">
            {isSelected && (
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" strokeWidth="3.2">
                <path d="M6.5 12.5l3.8 3.8 7.2-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          {icon && <Icon id={icon} size={20} />}
          <span>{children}</span>
        </>
      )}
    </AriaCheckbox>
  );
}
