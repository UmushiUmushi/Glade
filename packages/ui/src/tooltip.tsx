// Tooltip: a control's name (and its key) on hover and on keyboard focus, so everything has a
// name (docs/ui, principle 5). Styled like the design's dark info pills.

import type { ReactElement } from "react";
import { Tooltip as AriaTooltip, TooltipTrigger } from "react-aria-components";
import "./tooltip.css";

/** How long the pointer rests before a tooltip shows. Settings may change it later (Q-30). */
export const TOOLTIP_DELAY_MS = 600;

export interface TooltipProps {
  /** What the control does: "Rotate left". */
  text: string;
  /** Its key, shown after the text: "[". */
  shortcut?: string;
  /** The control it names. Must be focusable (a React Aria button). */
  children: ReactElement;
  placement?: "top" | "bottom" | "start" | "end";
  delay?: number;
}

export function Tooltip({ text, shortcut, children, placement = "top", delay }: TooltipProps) {
  return (
    <TooltipTrigger delay={delay ?? TOOLTIP_DELAY_MS}>
      {children}
      <AriaTooltip className="glade-tooltip" placement={placement} offset={8}>
        {text}
        {shortcut && <kbd className="glade-tooltip-key">{shortcut}</kbd>}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
