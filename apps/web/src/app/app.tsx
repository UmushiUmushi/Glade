// The app's root: Glade's own theme following the system's light or dark, a safety net around the
// whole screen, and for now a placeholder page that shows the server answers. Routes, the game
// registry and the home page arrive in Phase 1.

import { messageOf, type GladeError } from "@glade/errors";
import type { Health } from "@glade/formats";
import { gladeTheme, ThemeRoot } from "@glade/ui";
import { useEffect, useState } from "react";
import { checkServer, type ApiClient } from "../platform/api-client";
import { RegionBoundary } from "./region-boundary";

export interface AppProps {
  api: ApiClient;
  onError: (error: GladeError) => void;
}

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

function Placeholder({ api }: { api: ApiClient }) {
  const server = useServer(api);
  return (
    <main
      style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px", display: "grid", gap: 12 }}
    >
      <h1 style={{ margin: 0, fontFamily: "var(--font-title)", color: "var(--ink-title)" }}>
        Glade
      </h1>
      <p style={{ margin: 0 }}>Plan maps and build items for cosy building games.</p>
      <p role="status" style={{ margin: 0, color: "var(--ink-muted)" }}>
        {serverText(server)}
      </p>
    </main>
  );
}

export function App({ api, onError }: AppProps) {
  return (
    <ThemeRoot theme={gladeTheme} mode="system">
      <div style={{ minHeight: "100vh", background: "var(--ground)" }}>
        <RegionBoundary region="app" onError={onError}>
          <Placeholder api={api} />
        </RegionBoundary>
      </div>
    </ThemeRoot>
  );
}
