// Switch: on or off, right away (role="switch"). From the design's filter switch: a 40 × 24 track
// with a knob that slides across, the selected colour when on.

import type { ReactNode } from "react";
import { Switch as AriaSwitch, type SwitchProps as AriaSwitchProps } from "react-aria-components";
import "./switch.css";

export interface SwitchProps extends Omit<AriaSwitchProps, "children" | "className" | "style"> {
  /** The visible label. Leave it out only with an aria-label. */
  children?: ReactNode;
}

export function Switch({ children, ...rest }: SwitchProps) {
  return (
    <AriaSwitch {...rest} className="glade-switch">
      {children && <span className="glade-switch-label">{children}</span>}
      <span className="glade-switch-track" aria-hidden="true">
        <span className="glade-switch-knob" />
      </span>
    </AriaSwitch>
  );
}
