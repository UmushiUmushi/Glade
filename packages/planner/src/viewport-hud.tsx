// The controls over the map (docs/planner/screen.md, Viewport): the mode buttons, undo and redo
// and the save status at the top left; the viewport menu at the top right (Preview, 2D or 3D, the
// 3D camera, Fit, and Collapse to a slim tag); FPS and coordinates at the bottom left. In Preview
// only a closed-eye button stays, to come back. The modes come from the game.

import { Icon, IconButton, Menu, MenuItem, Pill, Tooltip, type IconId } from "@glade/ui";
import type { ReactNode } from "react";
import { Button as AriaButton } from "react-aria-components";
import type { CameraKind, PlannerAction, PlannerState, ViewKind } from "./state";
import "./viewport-hud.css";

/** One of a map's modes, from its game: "Items", with its icon and what it is for. */
export interface ModeDef {
  id: string;
  label: string;
  icon: IconId;
  /** What the mode is for: "Items mode: place and move items". */
  tip: string;
}

export interface ViewportHudProps {
  state: PlannerState;
  dispatch: (action: PlannerAction) => void;
  modes: readonly ModeDef[];
  /** The views the map has: both, or only one (then no 2D/3D button). */
  views: readonly ViewKind[];
  onFit: () => void;
  /** Frames a second, once known. */
  fps: number | null;
  /** Where the pointer is, in the mode's words: "Tile 34.5, 40 · Area C3". */
  coords: string | null;
  /** The save status pill, once the map saves (Phase 2). */
  saveStatus?: ReactNode;
}

const CAMERAS: { id: CameraKind; label: string }[] = [
  { id: "iso", label: "Iso" },
  { id: "top", label: "Top" },
  { id: "walk", label: "Walk" },
];

function ModeButtons({ modes, state, dispatch }: ViewportHudProps) {
  return (
    <div role="group" aria-label="Viewport mode" className="glade-modes">
      {modes.map((m, i) => {
        const on = m.id === state.mode;
        return (
          <Tooltip key={m.id} text={m.tip} shortcut={String(i + 1)} placement="bottom">
            <AriaButton
              className="glade-mode"
              aria-label={`${m.label} mode`}
              aria-pressed={on}
              data-on={on ? "" : undefined}
              onPress={() => dispatch({ type: "mode", mode: m.id })}
            >
              <span className="glade-mode-base">
                <span className="glade-mode-icon">
                  <Icon id={m.icon} size={on ? 50 : 40} />
                </span>
              </span>
              {on && <span className="glade-mode-name">{m.label}</span>}
            </AriaButton>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** The viewport menu folded into a slim tag; it opens again on a click. */
function ViewMenuTag({ dispatch }: Pick<ViewportHudProps, "dispatch">) {
  return (
    <Tooltip text="Show viewport menu" placement="start">
      <AriaButton
        className="glade-view-tag"
        aria-label="Show viewport menu"
        onPress={() => dispatch({ type: "view-menu", open: true })}
      >
        <Icon id="chevron-left" size={16} strokeWidth={2.8} />
      </AriaButton>
    </Tooltip>
  );
}

/** The 3D camera's button: its name, and a menu of the three. */
function CameraPicker({ state, dispatch }: Pick<ViewportHudProps, "state" | "dispatch">) {
  const camera = CAMERAS.find((c) => c.id === state.camera) ?? CAMERAS[0];
  return (
    <Menu
      label="3D view"
      placement="end top"
      width={120}
      selected={state.camera}
      onSelectedChange={(id) => dispatch({ type: "camera", camera: id as CameraKind })}
      trigger={
        <AriaButton className="glade-view-camera" aria-label={`View: ${camera.label}. Change view`}>
          {camera.label}
        </AriaButton>
      }
    >
      {CAMERAS.map((c) => (
        <MenuItem key={c.id} id={c.id}>
          {c.label}
        </MenuItem>
      ))}
    </Menu>
  );
}

function ViewportMenu({ state, dispatch, views, onFit }: ViewportHudProps) {
  if (state.viewMenu === "closed") return <ViewMenuTag dispatch={dispatch} />;
  const other: ViewKind = state.view === "2d" ? "3d" : "2d";
  return (
    <div
      role="toolbar"
      aria-label="Viewport menu"
      aria-orientation="vertical"
      className="glade-view-menu"
    >
      <IconButton
        label="Preview: hide the panels"
        icon="eye"
        shortcut="P"
        variant="float"
        tooltipPlacement="start"
        onPress={() => dispatch({ type: "preview", on: true })}
      />
      {views.length > 1 && (
        <Tooltip
          text={`Showing ${state.view.toUpperCase()}. Switch to ${other.toUpperCase()}`}
          placement="start"
        >
          <AriaButton
            className="glade-view-dim"
            aria-label={`Showing ${state.view.toUpperCase()}. Switch to ${other.toUpperCase()}`}
            onPress={() => dispatch({ type: "view", view: other })}
          >
            {state.view.toUpperCase()}
          </AriaButton>
        </Tooltip>
      )}
      {state.view === "3d" && <CameraPicker state={state} dispatch={dispatch} />}
      <IconButton
        label="Fit: back to the default view"
        icon="fit"
        shortcut="F"
        variant="float"
        tooltipPlacement="start"
        onPress={onFit}
      />
      <Tooltip text="Collapse" placement="start">
        <AriaButton
          className="glade-view-collapse"
          aria-label="Collapse viewport menu"
          onPress={() => dispatch({ type: "view-menu", open: false })}
        >
          <Icon id="chevron-right" size={16} strokeWidth={2.8} />
        </AriaButton>
      </Tooltip>
    </div>
  );
}

export function ViewportHud(props: ViewportHudProps) {
  const { state, dispatch } = props;
  if (state.preview) {
    return (
      <div className="glade-hud-corner">
        <IconButton
          label="Exit preview"
          icon="eye-off"
          shortcut="Esc"
          variant="float"
          tooltipPlacement="start"
          onPress={() => dispatch({ type: "preview", on: false })}
        />
      </div>
    );
  }
  return (
    <>
      <div className="glade-hud-top">
        {props.modes.length > 0 && <ModeButtons {...props} />}
        {props.modes.length > 0 && <div className="glade-hud-divider" aria-hidden="true" />}
        <div className="glade-hud-history">
          <IconButton
            label="Nothing to undo"
            icon="undo"
            shortcut="Ctrl+Z"
            variant="float"
            isDisabled
          />
          <IconButton
            label="Nothing to redo"
            icon="redo"
            shortcut="Ctrl+Y"
            variant="float"
            isDisabled
          />
          {props.saveStatus}
        </div>
      </div>
      <div className="glade-hud-corner">
        <ViewportMenu {...props} />
      </div>
      <div className="glade-hud-stats">
        {props.fps !== null && <Pill>{`${props.fps} FPS`}</Pill>}
        {props.coords && <Pill>{props.coords}</Pill>}
      </div>
    </>
  );
}

export type SaveState = "saved" | "saving" | "failed";

const SAVE_WORDS: Record<SaveState, { label: string; icon: IconId }> = {
  saved: { label: "Saved", icon: "save" },
  saving: { label: "Saving…", icon: "save" },
  failed: { label: "Couldn't save", icon: "alert" },
};

/**
 * The save status pill: "Saved", "Saving…" or "Couldn't save" (then a click tries again). Its
 * tooltip says where the map lives; screen readers hear the changes as they happen.
 */
export function SaveStatus(props: { state: SaveState; where: string; onRetry: () => void }) {
  const words = SAVE_WORDS[props.state];
  const detail = props.state === "failed" ? "Try saving again" : `Saved ${props.where}`;
  return (
    <Tooltip text={detail} placement="bottom">
      <AriaButton
        className="glade-save"
        data-state={props.state}
        aria-label={`${words.label}. ${detail}`}
        onPress={() => {
          if (props.state === "failed") props.onRetry();
        }}
      >
        <Icon id={words.icon} size={18} strokeWidth={2.6} />
        <span>{words.label}</span>
        <span role="status" className="glade-visually-hidden">
          {words.label}
        </span>
      </AriaButton>
    </Tooltip>
  );
}
