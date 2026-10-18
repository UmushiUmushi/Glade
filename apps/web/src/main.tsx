// Starts Glade in the browser: logging first (so a crash while starting is logged), then the API
// client and the browser's history, then the screen. Everything the app needs from the browser is handed in here.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/app";
import { browserHistory } from "./app/routes";
import { createApiClient } from "./platform/api-client";
import { startLogging } from "./platform/logging";

const logging = startLogging({
  window,
  indexedDB: window.indexedDB,
  clock: { now: () => performance.now(), epoch: () => Date.now() },
  timers: {
    setInterval: (run, ms) => window.setInterval(run, ms),
    clearInterval: (h) => window.clearInterval(h as number),
  },
  rng: Math.random,
  glade: {
    version: import.meta.env.VITE_GLADE_VERSION ?? "0.0.0-dev",
    commit: import.meta.env.VITE_GLADE_COMMIT ?? "dev",
  },
  strict: import.meta.env.DEV,
});

const api = createApiClient({ fetch: (input, init) => window.fetch(input, init) });

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App
        api={api}
        history={browserHistory(window)}
        onError={(error) => logging.logger.error(error)}
      />
    </StrictMode>,
  );
}
