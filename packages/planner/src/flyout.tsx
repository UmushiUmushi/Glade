// A flyout: a small popup beside a rail button with the panel controls the rail has no room for
// (docs/planner/screen.md, The rail). It opens after the pointer rests 300 ms on the button, or at
// once when the button is clicked or gets keyboard focus. The right arrow moves the keyboard into
// it; Esc closes it and puts the keyboard back on the button; it closes when the pointer and the
// keyboard have both left it and its button.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Popover } from "react-aria-components";
import "./flyout.css";

export const FLYOUT_OPEN_MS = 300;
export const FLYOUT_CLOSE_MS = 250;

/** Whether a node is inside any of the given elements. */
const within = (node: EventTarget | null, ...els: (Element | null)[]) =>
  node instanceof Node && els.some((el) => el?.contains(node));

export interface FlyoutProps {
  /** Names the flyout's group for screen readers: "Selection options". */
  label: string;
  /** The rail button, given whether the flyout is open and a way to toggle it. */
  trigger: (flyout: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
}

/** Open or shut, now or after a pause; a newer wish replaces a waiting one. */
function useOpenLater() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const later = (next: boolean, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), ms);
  };
  return { open, setOpen, later, now: (next: boolean) => later(next, 0) };
}

type OpenLater = ReturnType<typeof useOpenLater>;

/** The popup beside the button: its group, kept open while the pointer is over it. */
function FlyoutPanel(props: {
  label: string;
  anchor: RefObject<HTMLSpanElement | null>;
  panel: RefObject<HTMLDivElement | null>;
  flyout: OpenLater;
  children: ReactNode;
}) {
  const { anchor, panel, flyout } = props;
  return (
    <Popover
      triggerRef={anchor}
      isOpen={flyout.open}
      onOpenChange={flyout.setOpen}
      isNonModal
      placement="end top"
      offset={8}
      className="glade-flyout"
    >
      <div
        ref={panel}
        role="group"
        aria-label={props.label}
        className="glade-flyout-body"
        onMouseEnter={() => flyout.later(true, 0)}
        onMouseLeave={() => flyout.later(false, FLYOUT_CLOSE_MS)}
        onBlur={(e) => {
          if (!within(e.relatedTarget, anchor.current, panel.current)) flyout.now(false);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          e.stopPropagation();
          flyout.setOpen(false);
          anchor.current?.querySelector<HTMLElement>("button")?.focus();
        }}
      >
        {props.children}
      </div>
    </Popover>
  );
}

export function Flyout({ label, trigger, children }: FlyoutProps) {
  const anchor = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const flyout = useOpenLater();
  const { open, setOpen, later, now } = flyout;
  const focusInside = () =>
    panel.current?.querySelector<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), [tabindex='0']",
    );
  return (
    <>
      <span
        ref={anchor}
        className="glade-flyout-anchor"
        onMouseEnter={() => later(true, FLYOUT_OPEN_MS)}
        onMouseLeave={() => later(false, FLYOUT_CLOSE_MS)}
        onFocus={(e) => {
          // Focus coming back from the flyout (after Esc) leaves it shut.
          if (!within(e.relatedTarget, panel.current)) now(true);
        }}
        onBlur={(e) => {
          if (!within(e.relatedTarget, anchor.current, panel.current)) now(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusInside()?.focus());
          } else if (e.key === "Escape" && open) {
            e.preventDefault();
            now(false);
          }
        }}
      >
        {trigger({ open, toggle: () => setOpen((o) => !o) })}
      </span>
      <FlyoutPanel label={label} anchor={anchor} panel={panel} flyout={flyout}>
        {children}
      </FlyoutPanel>
    </>
  );
}
