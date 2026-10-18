// The side panel (docs/planner/screen.md, Side panel): a pinned header (Menu, game picker,
// Minimize) over sections that scroll: Tools, Select, the game's Environment, and Layers. Each
// section has a real heading; each group of buttons is a toolbar (Tab enters it, arrow keys move
// inside it). The same panel for every game: a game gives it its layer rows and its environment.

import { Button, Checkbox, Icon, IconButton, Tooltip, type IconId } from "@glade/ui";
import type { ReactNode } from "react";
import { ToggleButton, ToggleButtonGroup, Toolbar, type Key } from "react-aria-components";
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
import "./side-panel.css";

export interface SidePanelProps {
  state: PlannerState;
  dispatch: (action: PlannerAction) => void;
  /** The Menu button (and its menu). */
  menu: ReactNode;
  /** The game picker. */
  picker: ReactNode;
  /** The game's Environment section, if the map has one. */
  environment?: ReactNode;
  layers: readonly LayerRow[];
  onClearSelection: () => void;
}

interface ToolDef {
  id: ToolId | SelectMode;
  label: string;
  icon: IconId;
  shortcut?: string;
}

const TOOLS: ToolDef[] = [
  { id: "camera", label: "Camera: drag to orbit around the centre", icon: "grab", shortcut: "H" },
  {
    id: "pointer",
    label: "Pointer: click to select, drag to move",
    icon: "pointer",
    shortcut: "V",
  },
];

const SELECT_TOOLS: ToolDef[] = [
  { id: "lasso", label: "Lasso", icon: "lasso", shortcut: "L" },
  { id: "select-rect", label: "Rectangle select", icon: "select-rect", shortcut: "M" },
  { id: "select-circle", label: "Circle select", icon: "select-circle", shortcut: "O" },
  { id: "magic", label: "Magic select (flood)", icon: "magic", shortcut: "Y" },
];

const MODES: ToolDef[] = [
  { id: "set", label: "Set: replace the selection", icon: "select-set" },
  { id: "add", label: "Add to the selection", icon: "select-add", shortcut: "Ctrl" },
  {
    id: "subtract",
    label: "Subtract from the selection",
    icon: "select-subtract",
    shortcut: "Alt",
  },
];

function Section(props: { id: string; title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="glade-panel-section" aria-labelledby={props.id}>
      <div className="glade-panel-section-head">
        <h2 id={props.id} className="glade-panel-heading">
          {props.title}
        </h2>
        {props.aside && <span className="glade-panel-aside">{props.aside}</span>}
      </div>
      {props.children}
    </section>
  );
}

/** A group of round tool buttons, one of them chosen: a toolbar of toggles. */
function ToolGroup(props: {
  label: string;
  tools: ToolDef[];
  chosen: string;
  onChoose: (id: string) => void;
  variant?: "tool" | "segment";
}) {
  const segment = props.variant === "segment";
  return (
    <ToggleButtonGroup
      aria-label={props.label}
      className={segment ? "glade-segments" : "glade-tool-group"}
      selectionMode="single"
      selectedKeys={props.tools.some((t) => t.id === props.chosen) ? [props.chosen] : []}
      onSelectionChange={(keys) => {
        const [first] = keys as Set<Key>;
        if (first !== undefined) props.onChoose(String(first));
      }}
    >
      {props.tools.map((t) => (
        <Tooltip key={t.id} text={t.label} shortcut={t.shortcut}>
          <ToggleButton
            id={t.id}
            aria-label={t.label}
            className={segment ? "glade-segment" : "glade-tool"}
          >
            <Icon id={t.icon} size={segment ? 18 : 24} strokeWidth={2.6} />
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}

function LayerToggle(props: {
  row: LayerRow;
  state: PlannerState;
  dispatch: SidePanelProps["dispatch"];
}) {
  const { row, state } = props;
  const locked = isLocked(state, row.id);
  const visible = isVisible(state, row.id);
  return (
    <ToggleButton
      className="glade-layer-row"
      isSelected={visible}
      isDisabled={locked}
      onChange={() => props.dispatch({ type: "toggle-layer", id: row.id })}
      aria-label={locked ? `${row.label} (tick Always on to use)` : row.label}
    >
      <span className="glade-layer-disc" aria-hidden="true">
        <Icon id={row.icon} size={18} />
      </span>
      <span className="glade-layer-name">{row.label}</span>
      <Icon id={visible ? "eye" : "eye-off"} size={20} />
    </ToggleButton>
  );
}

function SelectSection({ state, dispatch, onClearSelection }: SidePanelProps) {
  return (
    <Section id="glade-panel-select" title="Select">
      <div className="glade-panel-row">
        <ToolGroup
          label="Selection tool"
          tools={SELECT_TOOLS}
          chosen={state.tool}
          onChoose={(id) => dispatch({ type: "tool", tool: id as ToolId })}
        />
        <ToolGroup
          label="Selection mode"
          variant="segment"
          tools={MODES}
          chosen={state.selectMode}
          onChoose={(id) => dispatch({ type: "select-mode", mode: id as SelectMode })}
        />
      </div>
      <div className="glade-panel-row">
        <div className="glade-panel-grow">
          <Tooltip text="Clear selection" shortcut="Esc">
            <Button icon="clear" onPress={onClearSelection}>
              Clear Selection
            </Button>
          </Tooltip>
        </div>
        <Checkbox isSelected={state.ruler} onChange={(on) => dispatch({ type: "ruler", on })}>
          Ruler
        </Checkbox>
      </div>
    </Section>
  );
}

function LayersSection({ state, dispatch, layers }: SidePanelProps) {
  const visibleCount = layers.filter((r) => isVisible(state, r.id)).length;
  // The design lists the ticks the other way up: Area, then Grid.
  const hosts = layers.filter((r) => r.host).reverse();
  return (
    <Section
      id="glade-panel-layers"
      title="Layers"
      aside={`${visibleCount} of ${layers.length} visible`}
    >
      <Toolbar aria-label="Layers" orientation="vertical" className="glade-layer-rows">
        {layers.map((row) => (
          <LayerToggle key={row.id} row={row} state={state} dispatch={dispatch} />
        ))}
      </Toolbar>
      {hosts.length > 0 && (
        <div className="glade-panel-always">
          {hosts.map((row) => (
            <Checkbox
              key={row.id}
              isSelected={state.alwaysOn[row.host as HostLayer]}
              onChange={(on) => dispatch({ type: "always-on", layer: row.host as HostLayer, on })}
            >
              {`Always on: ${row.label}`}
            </Checkbox>
          ))}
        </div>
      )}
    </Section>
  );
}

export function SidePanel(props: SidePanelProps) {
  const { state, dispatch } = props;
  return (
    <>
      <div className="glade-panel-header">
        {props.menu}
        <div className="glade-panel-picker">{props.picker}</div>
        <IconButton
          label="Minimize panel"
          icon="chevron-left"
          variant="strong"
          tooltipPlacement="bottom"
          onPress={() => dispatch({ type: "panel", panel: "rail" })}
        />
      </div>
      <div className="glade-panel-body">
        <Section id="glade-panel-tools" title="Tools" aside="Hold Shift to swap">
          <ToolGroup
            label="Tools"
            tools={TOOLS}
            chosen={state.tool}
            onChoose={(id) => dispatch({ type: "tool", tool: id as ToolId })}
          />
        </Section>
        <SelectSection {...props} />
        {props.environment}
        <LayersSection {...props} />
      </div>
    </>
  );
}

/** The rail's header for now: Menu and Expand. Its full set of buttons arrives in step 1.6. */
export function RailHeader(props: { menu: ReactNode; dispatch: SidePanelProps["dispatch"] }) {
  return (
    <div className="glade-rail-header">
      {props.menu}
      <IconButton
        label="Expand panel"
        icon="chevron-right"
        variant="strong"
        tooltipPlacement="end"
        onPress={() => props.dispatch({ type: "panel", panel: "open" })}
      />
    </div>
  );
}
