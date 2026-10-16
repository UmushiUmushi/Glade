// A safety net for one region of the screen (the side panel, the viewport, the toolbox…): a crash
// while drawing it shows "This part stopped working" there, with Reload, and the rest of Glade
// keeps working. The crash is logged once, here (docs/logging/errors.md).

import { gladeError, messageOf, type GladeError } from "@glade/errors";
import { Button } from "@glade/ui";
import { Component, type ErrorInfo, type ReactNode } from "react";

export interface RegionBoundaryProps {
  /** Which region, for the log: "app", "side-panel". */
  region: string;
  onError?: (error: GladeError) => void;
  children: ReactNode;
}

export class RegionBoundary extends Component<RegionBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onError?.(
      gladeError("GLD-UI-001", { cause: error, detail: { region: this.props.region } }),
    );
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    const message = messageOf(gladeError("GLD-UI-001"));
    return (
      <div role="alert" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <strong>{message.what}</strong>
        <span style={{ color: "var(--ink-muted)" }}>{message.safe}</span>
        <div>
          <Button variant="primary" icon="redo" onPress={() => this.setState({ failed: false })}>
            Reload part
          </Button>
        </div>
      </div>
    );
  }
}
