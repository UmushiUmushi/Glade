// The app's pages and their URLs (docs/architecture.md, The two apps): the home page at /, each
// game's planner at /<game>/planner, and a page for anything else. The browser's history is
// passed in, so tests and stories run the app at any URL without a browser.

export type Route =
  { page: "home" } | { page: "planner"; game: string } | { page: "not-found"; path: string };

/** The page a URL path opens. A trailing slash and a query or hash don't change it. */
export function parseRoute(path: string): Route {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (clean === "/") return { page: "home" };
  const parts = clean.split("/").slice(1);
  if (parts.length === 2 && parts[1] === "planner" && /^[a-z0-9-]+$/.test(parts[0])) {
    return { page: "planner", game: parts[0] };
  }
  return { page: "not-found", path: clean };
}

/** The URL path of a page. */
export function routePath(route: Route): string {
  switch (route.page) {
    case "home":
      return "/";
    case "planner":
      return `/${route.game}/planner`;
    case "not-found":
      return route.path;
  }
}

/** The browser's address and history, as the app uses them. */
export interface AppHistory {
  /** The current URL path. */
  path(): string;
  /** Go to a path, adding a history entry. */
  push(path: string): void;
  /** Called when the path changes by back or forward; returns a function that stops it. */
  listen(onChange: () => void): () => void;
}

/** The real browser history. */
export function browserHistory(w: Window): AppHistory {
  const listeners = new Set<() => void>();
  return {
    path: () => w.location.pathname,
    push(path) {
      if (path === w.location.pathname) return;
      w.history.pushState(null, "", path);
      listeners.forEach((run) => run());
    },
    listen(onChange) {
      listeners.add(onChange);
      w.addEventListener("popstate", onChange);
      return () => {
        listeners.delete(onChange);
        w.removeEventListener("popstate", onChange);
      };
    },
  };
}

/** A history in memory, for tests and stories. */
export function memoryHistory(start = "/"): AppHistory & { entries: string[] } {
  const entries = [start];
  const listeners = new Set<() => void>();
  return {
    entries,
    path: () => entries[entries.length - 1],
    push(path) {
      if (path === entries[entries.length - 1]) return;
      entries.push(path);
      listeners.forEach((run) => run());
    },
    listen(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
}
