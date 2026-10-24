// The planner's side panel, or the rail when it is minimized, with the Menu (Home for now; the rest
// arrives in step 1.11) and the game picker to suit: the pill in the panel, the game's logo on the
// rail.

import { EnvironmentSection, Rail, SidePanel } from "@glade/planner";
import { GamePicker, IconButton, Menu, MenuItem, type GameChoice } from "@glade/ui";
import type { GamePlanner, GladeGame } from "../games";
import { useHistory } from "../navigation";
import { routePath } from "../routes";
import type { Plan } from "./use-planner";

/** The games as the picker lists them: each in its own title font, the unready ones "Soon". */
export function gameChoices(games: readonly GladeGame[]): GameChoice[] {
  return games.map((g) => ({
    id: g.id,
    title: g.title,
    titleFont: g.theme?.shape.fontTitle,
    ready: g.planner !== null,
    logo: g.logo,
  }));
}

function MainMenu() {
  const history = useHistory();
  return (
    <Menu
      label="Menu"
      trigger={<IconButton label="Menu, not logged in" icon="more" variant="strong" />}
      onAction={(id) => {
        if (id === "home") history.push(routePath({ page: "home" }));
      }}
    >
      <MenuItem id="home" icon="home">
        Home
      </MenuItem>
    </Menu>
  );
}

export function PlannerPanel(props: {
  game: GladeGame;
  games: readonly GladeGame[];
  planner: GamePlanner;
  plan: Plan;
  onClearSelection: () => void;
}) {
  const history = useHistory();
  const { state, dispatch, time } = props.plan;
  const picker = (compact: boolean) => (
    <GamePicker
      games={gameChoices(props.games)}
      current={props.game.id}
      compact={compact}
      onPick={(id) => history.push(routePath({ page: "planner", game: id }))}
    />
  );
  if (state.panel === "rail") {
    return (
      <Rail
        state={state}
        dispatch={dispatch}
        menu={<MainMenu />}
        picker={picker(true)}
        layers={props.planner.layers}
        time={time}
        onClearSelection={props.onClearSelection}
      />
    );
  }
  return (
    <SidePanel
      state={state}
      dispatch={dispatch}
      menu={<MainMenu />}
      picker={picker(false)}
      layers={props.planner.layers}
      environment={
        // A map with a fixed look (one time, no seasons) has no Environment section.
        time.stops.length > 1 && (
          <EnvironmentSection
            state={state}
            dispatch={dispatch}
            stops={time.stops}
            hasSnow={time.hasSnow}
          />
        )
      }
      onClearSelection={props.onClearSelection}
    />
  );
}
