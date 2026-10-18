// The planner's layout (docs/planner/screen.md, Layouts): three cards on the tray. The side panel
// on the left (336 px open, 76 px as the rail), the viewport filling the rest, and the toolbox
// docked under it. Each card is a named region for screen readers. The cards' look (corners,
// border, lip, gap) comes from the theme, so every game gets its own with the same layout.

import type { ReactNode } from "react";
import "./planner-layout.css";

export interface PlannerLayoutProps {
  /** The side panel: open (full width) or minimised to the rail. */
  panelState: "open" | "rail";
  panel: ReactNode;
  /** The map. */
  viewport: ReactNode;
  /** The toolbox under the map; left out, the map takes its place. */
  toolbox?: ReactNode;
}

export function PlannerLayout(props: PlannerLayoutProps) {
  const open = props.panelState === "open";
  return (
    <div className="glade-planner-tray">
      {open ? (
        <aside className="glade-planner-card glade-planner-panel" aria-label="Planner controls">
          {props.panel}
        </aside>
      ) : (
        <nav
          className="glade-planner-card glade-planner-panel"
          data-rail=""
          aria-label="Planner controls, minimized"
        >
          {props.panel}
        </nav>
      )}
      <div className="glade-planner-main">
        <section className="glade-planner-card glade-planner-viewport" aria-label="Map viewport">
          {props.viewport}
        </section>
        {props.toolbox !== undefined && (
          <section className="glade-planner-card glade-planner-toolbox" aria-label="Toolbox">
            {props.toolbox}
          </section>
        )}
      </div>
    </div>
  );
}
