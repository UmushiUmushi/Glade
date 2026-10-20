// A game's planner at /<game>/planner, in the game's own look: the planner's three cards on the
// tray. The side panel (or its rail) drives the planner's own state; the layer rows hide map
// layers and the time and snow set the look in the viewport. The toolbox's contents arrive in step
// 1.8; the Menu holds Home until the rest of it arrives in step 1.11.

import {
  EnvironmentSection,
  initialPlanner,
  mapLayers,
  PlannerLayout,
  plannerReducer,
  Rail,
  SidePanel,
  timeStopsFor,
  useScreenLayout,
  type LayoutSetting,
} from "@glade/planner";
import { GamePicker, IconButton, Menu, MenuItem, type GameChoice } from "@glade/ui";
import {
  MapViewport,
  seasons,
  startEnvironment,
  startView,
  timeStops,
  type Environment,
} from "@glade/viewport";
import { useEffect, useMemo, useReducer } from "react";
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

/**
 * The planner's own state for a map: open on a desktop, the rail on a tablet (the phone layout, a
 * top bar, arrives in step 1.9), and the map layer toggles the layer rows give the viewport.
 */
function usePlanner(planner: GamePlanner, layout: LayoutSetting | undefined) {
  const screen = useScreenLayout(layout);
  const start = useMemo(() => startEnvironment(planner.map), [planner]);
  const [state, dispatch] = useReducer(
    plannerReducer,
    { panel: screen === "desktop" ? "open" : "rail", hour: start.hour },
    initialPlanner,
  );
  useEffect(
    () => dispatch({ type: "panel", panel: screen === "desktop" ? "open" : "rail" }),
    [screen],
  );
  const defaults = useMemo(
    () => Object.fromEntries(planner.map.ui.layerNames().map((l) => [l.id, l.default])),
    [planner],
  );
  const layers = useMemo(
    () => mapLayers(state, planner.layers, defaults),
    [state, planner, defaults],
  );
  const time = useMemo(() => {
    const stops = timeStopsFor(timeStops(planner.map), planner.timeStops);
    const snow = planner.snowSeason;
    return { stops, hasSnow: !!snow && seasons(planner.map).includes(snow) };
  }, [planner]);
  const environment = useMemo<Environment>(
    () => ({
      hour: state.hour,
      season: state.snow && planner.snowSeason ? planner.snowSeason : start.season,
    }),
    [state.hour, state.snow, planner, start],
  );
  return { state, dispatch, layers, time, environment };
}

/** The side panel, or the rail when it is minimized, with the game picker to suit. */
function PlannerPanel({
  game,
  games,
  plan,
}: {
  game: GladeGame;
  games: readonly GladeGame[];
  plan: ReturnType<typeof usePlanner> & { planner: GamePlanner };
}) {
  const history = useHistory();
  const { state, dispatch, time, planner } = plan;
  const picker = (compact: boolean) => (
    <GamePicker
      games={gameChoices(games)}
      current={game.id}
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
        layers={planner.layers}
        time={time}
        onClearSelection={() => {}}
      />
    );
  }
  return (
    <SidePanel
      state={state}
      dispatch={dispatch}
      menu={<MainMenu />}
      picker={picker(false)}
      layers={planner.layers}
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
      onClearSelection={() => {}}
    />
  );
}

export function PlannerPage({ game, planner, games, layout }: PlannerPageProps) {
  const plan = usePlanner(planner, layout);
  const doc = useMemo(() => planner.newDoc(), [planner]);
  useEffect(() => {
    document.title = `${game.title} planner · Glade`;
  }, [game.title]);
  return (
    <main>
      <h1 className="glade-visually-hidden">{game.title} planner</h1>
      <PlannerLayout
        panelState={plan.state.panel}
        panel={<PlannerPanel game={game} games={games} plan={{ ...plan, planner }} />}
        viewport={
          <MapViewport
            map={planner.map}
            doc={doc}
            view={startView(planner.map)}
            camera="iso"
            environment={plan.environment}
            layers={plan.layers}
            label={`${game.title} map, new and empty`}
          />
        }
        toolbox={null}
      />
    </main>
  );
}
