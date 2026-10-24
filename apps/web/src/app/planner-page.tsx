// A game's planner at /<game>/planner, in the game's own look: the planner's three cards on the
// tray. The side panel (or its rail) and the controls over the map drive the planner's own state;
// the layer rows hide map layers and the time and snow set the look in the viewport. In Preview
// only the map shows. The toolbox's contents arrive in step 1.8.

import { PlannerLayout, type LayoutSetting } from "@glade/planner";
import type { Viewport } from "@glade/viewport";
import { useEffect, useMemo, useRef } from "react";
import type { GamePlanner, GladeGame } from "./games";
import { PlannerMap } from "./planner/planner-map";
import { PlannerPanel } from "./planner/planner-panel";
import { usePlanner } from "./planner/use-planner";

export { gameChoices } from "./planner/planner-panel";

export interface PlannerPageProps {
  game: GladeGame;
  planner: GamePlanner;
  games: readonly GladeGame[];
  /** Auto (the window's size decides) or a layout Settings forces. */
  layout?: LayoutSetting;
}

/** Selections arrive in Phase 3; until then there is nothing to clear. */
const clearSelection = () => {};

export function PlannerPage({ game, planner, games, layout }: PlannerPageProps) {
  const viewport = useRef<Viewport | null>(null);
  const fit = () => viewport.current?.fit();
  const plan = usePlanner(planner, layout, { fit, clearSelection });
  const doc = useMemo(() => planner.newDoc(), [planner]);
  useEffect(() => {
    document.title = `${game.title} planner · Glade`;
  }, [game.title]);
  return (
    <main>
      <h1 className="glade-visually-hidden">{game.title} planner</h1>
      <PlannerLayout
        panelState={plan.state.panel}
        preview={plan.state.preview}
        panel={
          <PlannerPanel
            game={game}
            games={games}
            planner={planner}
            plan={plan}
            onClearSelection={clearSelection}
          />
        }
        viewport={
          <PlannerMap
            title={game.title}
            planner={planner}
            doc={doc}
            plan={plan}
            onViewport={(vp) => (viewport.current = vp)}
            onFit={fit}
          />
        }
        toolbox={null}
      />
    </main>
  );
}
