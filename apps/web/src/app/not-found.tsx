// The pages for a URL that opens nothing: a path Glade doesn't have, and the planner of a game
// that isn't ready yet. Both in Glade's own look, saying what happened and how to get home.

import { useEffect } from "react";
import { Link } from "./navigation";

export function NotFoundPage() {
  useEffect(() => {
    document.title = "Page not found · Glade";
  }, []);
  return (
    <main className="glade-page">
      <h1 className="glade-page-title">Page not found</h1>
      <p>There's nothing at this address. It may be mistyped, or the page may have moved.</p>
      <p>
        <Link to="/">Go to the home page</Link>
      </p>
    </main>
  );
}

export function NotReadyPage({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} · Glade`;
  }, [title]);
  return (
    <main className="glade-page">
      <h1 className="glade-page-title">{title} isn't ready yet</h1>
      <p>Glade can't plan {title} maps yet. It's coming.</p>
      <p>
        <Link to="/">Go to the home page</Link>
      </p>
    </main>
  );
}
