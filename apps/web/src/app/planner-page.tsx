// A game's planner at /<game>/planner, in the game's own look: for now the game picker and the
// map, a new empty one, in the viewport. The planner's layout (side panel, viewport card, toolbox)
// arrives with step 1.3.

import { MapViewport, startView } from "@glade/viewport";
import { GamePicker, type GameChoice } from "@glade/ui";
import { useEffect, useMemo } from "react";
import type { GamePlanner, GladeGame } from "./games";
import { useHistory } from "./navigation";
import { routePath } from "./routes";

export interface PlannerPageProps {
  game: GladeGame;
  planner: GamePlanner;
  games: readonly GladeGame[];
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

export function PlannerPage({ game, planner, games }: PlannerPageProps) {
  const history = useHistory();
  const doc = useMemo(() => planner.newDoc(), [planner]);
  useEffect(() => {
    document.title = `${game.title} planner · Glade`;
  }, [game.title]);
  return (
    <main className="glade-planner">
      <header className="glade-planner-header">
        <div className="glade-planner-picker">
          <GamePicker
            games={gameChoices(games)}
            current={game.id}
            onPick={(id) => history.push(routePath({ page: "planner", game: id }))}
          />
        </div>
      </header>
      <div className="glade-planner-map">
        <MapViewport
          map={planner.map}
          doc={doc}
          view={startView(planner.map)}
          camera="iso"
          environment={NOON}
          label={`${game.title} map, new and empty`}
        />
      </div>
    </main>
  );
}
