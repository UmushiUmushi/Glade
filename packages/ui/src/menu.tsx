// Menu: a list of actions that pops up from a button (role="menu"). From the design: a rounded
// popup with rows 44 px tall, an icon before each word, dotted lines between groups. For a choice
// of one (the game picker), the chosen row shows a tick.

import type { ReactElement, ReactNode } from "react";
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  MenuTrigger,
  Popover,
  Separator,
  type Key,
  type MenuItemProps as AriaMenuItemProps,
} from "react-aria-components";
import { Icon, type IconId } from "./icons";
import "./menu.css";

export interface MenuProps {
  /** The button that opens it (a Button or IconButton). */
  trigger: ReactElement;
  /**
   * Names the menu for screen readers when its trigger can't: React Aria names a menu after the
   * button that opens it, which wins when that button has a name.
   */
  label: string;
  children: ReactNode;
  /** A choice of one: the chosen row's id. */
  selected?: Key;
  onAction?: (id: Key) => void;
  onSelectedChange?: (id: Key) => void;
  placement?: "bottom start" | "bottom end" | "top start" | "top end" | "end top";
  /** Popup width in CSS pixels (the design uses 240–280). */
  width?: number;
}

export function Menu(props: MenuProps) {
  const single = props.selected !== undefined;
  return (
    <MenuTrigger>
      {props.trigger}
      <Popover
        className="glade-menu-popup"
        placement={props.placement ?? "bottom start"}
        offset={8}
        style={{ width: props.width ?? 240 }}
      >
        <AriaMenu
          className="glade-menu"
          aria-label={props.label}
          onAction={(id) => props.onAction?.(id)}
          selectionMode={single ? "single" : undefined}
          selectedKeys={single ? [props.selected as Key] : undefined}
          onSelectionChange={(keys) => {
            if (keys === "all" || !props.onSelectedChange) return;
            const [first] = keys;
            if (first !== undefined) props.onSelectedChange(first);
          }}
        >
          {props.children}
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}

export interface MenuItemProps extends Omit<AriaMenuItemProps, "children" | "className" | "style"> {
  icon?: IconId;
  children: string;
  /** Shows the words as a title in this font (a game's name in its own title font). */
  titleFont?: string;
  /** A short word after the text, in a quiet pill: "Soon". */
  badge?: string;
}

export function MenuItem({ icon, children, titleFont, badge, ...rest }: MenuItemProps) {
  return (
    <AriaMenuItem {...rest} className="glade-menu-item" textValue={children}>
      {({ isSelected }) => (
        <>
          {icon && <Icon id={icon} size={20} />}
          <span
            className="glade-menu-item-text"
            data-title={titleFont ? "" : undefined}
            style={titleFont ? { fontFamily: titleFont } : undefined}
          >
            {children}
          </span>
          {isSelected && <Icon id="check" size={20} strokeWidth={3} />}
          {badge && <span className="glade-menu-item-badge">{badge}</span>}
        </>
      )}
    </AriaMenuItem>
  );
}

export function MenuSeparator() {
  return <Separator className="glade-menu-separator" />;
}
