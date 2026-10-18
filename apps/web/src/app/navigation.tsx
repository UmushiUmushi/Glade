// Moving between pages without reloading: the app's history for every page below it, the current
// route, and links that go through the history (a click with a modifier key, or a middle click,
// still opens a new tab as links do).

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from "react";
import { parseRoute, type AppHistory, type Route } from "./routes";

const HistoryContext = createContext<AppHistory | null>(null);

export const HistoryProvider = HistoryContext.Provider;

/** The app's history; only usable under a HistoryProvider. */
export function useHistory(): AppHistory {
  const history = useContext(HistoryContext);
  if (!history) throw new Error("useHistory needs a HistoryProvider above it");
  return history;
}

/** The page the current URL opens, kept up to date as it changes. */
export function useRoute(history: AppHistory): Route {
  const [path, setPath] = useState(() => history.path());
  useEffect(() => history.listen(() => setPath(history.path())), [history]);
  return parseRoute(path);
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
}

/** A link to another page of the app. */
export function Link({ to, onClick, ...rest }: LinkProps) {
  const history = useHistory();
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    e.preventDefault();
    history.push(to);
  };
  return <a href={to} onClick={go} {...rest} />;
}
