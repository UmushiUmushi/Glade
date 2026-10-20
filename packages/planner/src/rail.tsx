// The rail (docs/planner/screen.md, The rail): the side panel minimized to a 76 px column of round
// buttons. Everything in the panel still works from it: the active tool, the last select tool
// (its flyout holds all four and the modes), Clear and the ruler, the time (its flyout holds the
// slider) and snow, one button per layer row, the "Always on" ticks, and Expand.

import { Icon, IconButton, Tooltip, type IconId } from "@glade/ui";
import type { ReactNode } from "react";
import { ToggleButton } from "react-aria-components";
import { TimeSlider } from "./environment";
import { Flyout } from "./flyout";
import { MODE_DEFS, SELECT_TOOL_DEFS, ToolGroup } from "./side-panel";
import {
  isLocked,
  isVisible,
  type HostLayer,
  type LayerRow,
  type PlannerAction,
  type PlannerState,
  type SelectMode,
  type ToolId,
} from "./state";
import { nearestStop, type TimeStop } from "./time";
import "./rail.css";

export interface RailProps {
  state: PlannerState;
  dispatch: (action: PlannerAction) => void;
  /** The Menu button (and its menu). */
  menu: ReactNode;
  /** The game picker, compact: a round button with the game's logo. */
  picker: ReactNode;
  layers: readonly LayerRow[];
  /** The time of day and snow, if the map's look changes with them. */
  time?: { stops: readonly TimeStop[]; hasSnow: boolean };
  onClearSelection: () => void;
}

/** The badge on the Select button: how a new selection combines with the old. */
const MODE_BADGE: Record<SelectMode, string> = { set: "=", add: "+", subtract: "−" };

/** A rail toggle: filled when on, an outlined disc when off (layers and "Always on"). */
function RailToggle(props: {
  label: string;
  icon: IconId;
  on: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <Tooltip text={props.label} placement="end">
      <ToggleButton
        className="glade-rail-toggle"
        aria-label={props.label}
        isSelected={props.on}
        isDisabled={props.disabled}
        onChange={props.onChange}
      >
        <Icon id={props.icon} size={20} />
      </ToggleButton>
    </Tooltip>
  );
}

function RailSelect({ state, dispatch, onClearSelection }: RailProps) {
  const last = SELECT_TOOL_DEFS.find((t) => t.id === state.lastSelectTool) ?? SELECT_TOOL_DEFS[0];
  const mode = MODE_DEFS.find((m) => m.id === state.selectMode);
  const active = SELECT_TOOL_DEFS.some((t) => t.id === state.tool);
  return (
    <div className="glade-rail-section">
      <Flyout
        label="Selection options"
        trigger={() => (
          <Tooltip text={`Select: ${last.label}, ${state.selectMode}`} placement="end">
            <ToggleButton
              className="glade-tool"
              aria-label={`Select: ${last.label}, ${mode?.label.split(":")[0].toLowerCase()}`}
              isSelected={active}
              onChange={() => dispatch({ type: "tool", tool: last.id as ToolId })}
            >
              <Icon id={last.icon} size={22} strokeWidth={2.6} />
              <span className="glade-rail-badge" aria-hidden="true">
                {MODE_BADGE[state.selectMode]}
              </span>
            </ToggleButton>
          </Tooltip>
        )}
      >
        <span className="glade-flyout-heading">Select</span>
        <ToolGroup
          label="Selection tool"
          tools={SELECT_TOOL_DEFS}
          chosen={state.tool}
          onChoose={(id) => dispatch({ type: "tool", tool: id as ToolId })}
        />
        <ToolGroup
          label="Selection mode"
          variant="segment"
          tools={MODE_DEFS}
          chosen={state.selectMode}
          onChoose={(id) => dispatch({ type: "select-mode", mode: id as SelectMode })}
        />
      </Flyout>
      <IconButton
        label="Clear selection"
        icon="clear"
        shortcut="Esc"
        variant="float"
        tooltipPlacement="end"
        onPress={onClearSelection}
      />
      <IconButton
        label="Ruler"
        icon="ruler"
        shortcut="R"
        variant="float"
        tooltipPlacement="end"
        selected={state.ruler}
        onSelectedChange={(on) => dispatch({ type: "ruler", on })}
      />
    </div>
  );
}

function RailTime({ state, dispatch, time }: RailProps) {
  if (!time || time.stops.length < 2) return null;
  const stop = nearestStop(time.stops, state.hour);
  return (
    <div className="glade-rail-section">
      <Flyout
        label="Time of day"
        trigger={({ toggle }) => (
          <IconButton
            label={`Time of day: ${stop.label}`}
            icon={stop.icon}
            variant="float"
            tooltipPlacement="end"
            onPress={toggle}
          />
        )}
      >
        <TimeSlider state={state} dispatch={dispatch} stops={time.stops} width={176} />
      </Flyout>
      {time.hasSnow && (
        <IconButton
          label="Snow"
          icon="snow"
          variant="float"
          tooltipPlacement="end"
          selected={state.snow}
          onSelectedChange={(on) => dispatch({ type: "snow", on })}
        />
      )}
    </div>
  );
}

function RailLayers({ state, dispatch, layers }: RailProps) {
  const hosts = layers.filter((r) => r.host).reverse();
  return (
    <div className="glade-rail-section glade-rail-layers">
      {layers.map((row) => {
        const locked = isLocked(state, row.id);
        return (
          <RailToggle
            key={row.id}
            label={locked ? `${row.label} (tick Always on to use)` : row.label}
            icon={row.icon}
            on={isVisible(state, row.id)}
            disabled={locked}
            onChange={() => dispatch({ type: "toggle-layer", id: row.id })}
          />
        );
      })}
      {hosts.length > 0 && <div className="glade-rail-rule" />}
      {hosts.map((row) => {
        const layer = row.host as HostLayer;
        return (
          <RailToggle
            key={row.id}
            label={`Always on: ${row.label}`}
            icon={row.icon}
            on={state.alwaysOn[layer]}
            onChange={() => dispatch({ type: "always-on", layer, on: !state.alwaysOn[layer] })}
          />
        );
      })}
    </div>
  );
}

export function Rail(props: RailProps) {
  const { state, dispatch } = props;
  const camera = state.tool === "camera";
  return (
    <>
      <div className="glade-rail-header">
        {props.menu}
        {props.picker}
        <IconButton
          label="Expand panel"
          icon="chevron-right"
          variant="strong"
          tooltipPlacement="end"
          onPress={() => dispatch({ type: "panel", panel: "open" })}
        />
      </div>
      <div className="glade-rail-body">
        <div className="glade-rail-section">
          <Tooltip
            text={`${camera ? "Camera" : "Pointer"}: click to swap, or hold Shift`}
            placement="end"
          >
            <ToggleButton
              className="glade-tool"
              aria-label={camera ? "Camera" : "Pointer"}
              isSelected={state.tool === "camera" || state.tool === "pointer"}
              onChange={() => dispatch({ type: "tool", tool: camera ? "pointer" : "camera" })}
            >
              <Icon id={camera ? "grab" : "pointer"} size={24} />
            </ToggleButton>
          </Tooltip>
        </div>
        <RailSelect {...props} />
        <RailTime {...props} />
        <RailLayers {...props} />
      </div>
    </>
  );
}
