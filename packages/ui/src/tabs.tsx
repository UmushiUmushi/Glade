// Tabs: pick one view out of several (role="tablist"). From the design's category tabs: round
// pills in a row that scrolls sideways and fades at its right edge; the chosen tab takes the
// selected colour and the chunky shadow. Arrow keys move between tabs.

import type { ReactNode } from "react";
import {
  Tab as AriaTab,
  TabList as AriaTabList,
  TabPanel as AriaTabPanel,
  Tabs as AriaTabs,
  type Key,
  type TabListProps as AriaTabListProps,
} from "react-aria-components";
import "./tabs.css";

export interface TabsProps {
  selected?: Key;
  onSelectedChange?: (key: Key) => void;
  children: ReactNode;
}

export function Tabs(props: TabsProps) {
  return (
    <AriaTabs
      className="glade-tabs"
      selectedKey={props.selected}
      onSelectionChange={props.onSelectedChange}
    >
      {props.children}
    </AriaTabs>
  );
}

export function TabList<T extends object>(
  props: Omit<AriaTabListProps<T>, "className" | "style"> & { "aria-label": string },
) {
  return <AriaTabList {...props} className="glade-tab-list" />;
}

export function Tab(props: { id: Key; children: string }) {
  return (
    <AriaTab id={props.id} className="glade-tab">
      {props.children}
    </AriaTab>
  );
}

export function TabPanel(props: { id: Key; children: ReactNode }) {
  return (
    <AriaTabPanel id={props.id} className="glade-tab-panel">
      {props.children}
    </AriaTabPanel>
  );
}
