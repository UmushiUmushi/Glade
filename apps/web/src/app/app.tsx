// The app's root: picks the page from the URL and gives it its look. A game's planner wears the
// game's theme and icons; every other page wears Glade's own theme. Light or dark follows the
// system. A safety net goes round each page, so a crash shows a calm message, not a blank screen.

import type { GladeError } from "@glade/errors";
import type { LayoutSetting } from "@glade/planner";
import { gladeTheme, ThemeRoot, type GameIcons, type Theme } from "@glade/ui";
import type { ReactNode } from "react";
import type { ApiClient } from "../platform/api-client";
import "./app.css";
import { games as registry, type GladeGame } from "./games";
import { HomePage } from "./home";
import { HistoryProvider, useRoute } from "./navigation";
import { NotFoundPage, NotReadyPage } from "./not-found";
import { PlannerPage } from "./planner-page";
import type { AppHistory, Route } from "./routes";
import { RegionBoundary } from "./region-boundary";

export interface AppProps {
  api: ApiClient;
  history: AppHistory;
  onError: (error: GladeError) => void;
  /** The games to offer; the registry's unless a story or test passes its own. */
  games?: readonly GladeGame[];
  /** The planner's layout: auto (the window's size decides) or forced (Settings, stories). */
  layout?: LayoutSetting;
}

/** A page and the look it wears. */
interface Shown {
  page: ReactNode;
  theme: Theme;
  icons?: GameIcons;
}

function show(
  route: Route,
  api: ApiClient,
  games: readonly GladeGame[],
  layout: LayoutSetting,
): Shown {
  if (route.page === "home") {
    return { page: <HomePage api={api} games={games} />, theme: gladeTheme };
  }
  const game = route.page === "planner" ? games.find((g) => g.id === route.game) : undefined;
  if (game?.planner) {
    return {
      page: <PlannerPage game={game} planner={game.planner} games={games} layout={layout} />,
      theme: game.theme ?? gladeTheme,
      icons: game.icons,
    };
  }
  if (game) return { page: <NotReadyPage title={game.title} />, theme: gladeTheme };
  return { page: <NotFoundPage />, theme: gladeTheme };
}

export function App({ api, history, onError, games = registry, layout = "auto" }: AppProps) {
  const route = useRoute(history);
  const { page, theme, icons } = show(route, api, games, layout);
  return (
    <HistoryProvider value={history}>
      <ThemeRoot theme={theme} icons={icons} mode="system">
        <div className="glade-app">
          <RegionBoundary key={route.page} region="page" onError={onError}>
            {page}
          </RegionBoundary>
        </div>
      </ThemeRoot>
    </HistoryProvider>
  );
}
