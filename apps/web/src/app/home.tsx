// The home page at /: a plain stub in Glade's own look (no game's colours or fonts) until the real
// home page is designed. It says what Glade is, lists the games (a ready one links to its planner,
// the rest say "Soon"), and says whether the server answers.

import { messageOf } from "@glade/errors";
import type { Health } from "@glade/formats";
import { useEffect, useState } from "react";
import { checkServer, type ApiClient } from "../platform/api-client";
import type { GladeGame } from "./games";
import { Link } from "./navigation";
import { routePath } from "./routes";

type ServerState =
  { kind: "checking" } | { kind: "ok"; health: Health } | { kind: "error"; text: string };

/** Asks the server once, when the page opens. */
function useServer(api: ApiClient): ServerState {
  const [state, setState] = useState<ServerState>({ kind: "checking" });
  useEffect(() => {
    let live = true;
    void checkServer(api).then((result) => {
      if (!live) return;
      setState(
        result.ok
          ? { kind: "ok", health: result.value }
          : { kind: "error", text: messageOf(result.error).what },
      );
    });
    return () => {
      live = false;
    };
  }, [api]);
  return state;
}

function serverText(state: ServerState): string {
  if (state.kind === "checking") return "Checking the server…";
  if (state.kind === "error") return state.text;
  return state.health.status === "ok"
    ? `Server ok · version ${state.health.version}`
    : "The server is up, but not everything works.";
}

export interface HomePageProps {
  api: ApiClient;
  games: readonly GladeGame[];
}

export function HomePage({ api, games }: HomePageProps) {
  const server = useServer(api);
  useEffect(() => {
    document.title = "Glade";
  }, []);
  return (
    <main className="glade-page">
      <h1 className="glade-page-title">Glade</h1>
      <p>Plan maps and build items for cosy building games.</p>
      <h2 className="glade-page-heading">Games</h2>
      <ul className="glade-game-list">
        {games.map((g) => (
          <li key={g.id}>
            {g.planner ? (
              <Link to={routePath({ page: "planner", game: g.id })}>{g.title}</Link>
            ) : (
              <span className="glade-muted">
                {g.title} <span className="glade-soon">Soon</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p role="status" className="glade-muted">
        {serverText(server)}
      </p>
    </main>
  );
}
