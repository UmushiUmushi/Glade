// A game's planner at /<game>/planner, in the game's own look: the planner's three cards on the
// tray. For now the side panel holds its header's game picker and the viewport a new empty map;
// the panel's controls, the rail's buttons and the toolbox's contents arrive in steps 1.4 to 1.8.

import { PlannerLayout, useScreenLayout, type LayoutSetting } from "@glade/planner";
import { GamePicker, type GameChoice } from "@glade/ui";
import { MapViewport, startView } from "@glade/viewport";
import { useEffect, useMemo } from "react";
import type { GamePlanner, GladeGame } from "./games";
import { useHistory } from "./navigation";
import { routePath } from "./routes";

export interface PlannerPageProps {
  game: GladeGame;
  planner: GamePlanner;
  games: readonly GladeGame[];
  /** Auto (the window's size decides) or a layout Settings forces. */
  layout?: LayoutSetting;
}

/** The games as the picker lists them: each in its own title font, the unready ones "Soon". */
export function gameChoices(games: readonly GladeGame[]): GameChoice[] {
  return games.map((g) => ({
    id: g.id,
    title: g.title,
    titleFont: g.theme?.shape.fontTitle,
    ready: g.planner !== null,
  }));
}

const NOON = { hour: 12 };

export function PlannerPage({ game, planner, games, layout }: PlannerPageProps) {
  const history = useHistory();
  const doc = useMemo(() => planner.newDoc(), [planner]);
  // The rail on a tablet; the phone layout (a top bar) arrives in step 1.9, until then the rail.
  const panelState = useScreenLayout(layout) === "desktop" ? "open" : "rail";
  useEffect(() => {
    document.title = `${game.title} planner · Glade`;
  }, [game.title]);
  const picker = (
    <GamePicker
      games={gameChoices(games)}
      current={game.id}
      onPick={(id) => history.push(routePath({ page: "planner", game: id }))}
    />
  );
  return (
    <main>
      <h1 className="glade-visually-hidden">{game.title} planner</h1>
      <PlannerLayout
        panelState={panelState}
        panel={panelState === "open" && <div className="glade-planner-header">{picker}</div>}
        viewport={
          <MapViewport
            map={planner.map}
            doc={doc}
            view={startView(planner.map)}
            camera="iso"
            environment={NOON}
            label={`${game.title} map, new and empty`}
          />
        }
        toolbox={null}
      />
    </main>
  );
}
