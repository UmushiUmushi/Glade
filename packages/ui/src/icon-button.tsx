// IconButton: a round button with only an icon. It always has a name: `label` is read out by
// screen readers and shown as a tooltip. float: over the map. strong: the dark round button.
// plain: on a card. Give `selected` to make it a toggle (a tool that stays pressed).

import { Button as AriaButton, ToggleButton } from "react-aria-components";
import { Icon, type IconId } from "./icons";
import { Tooltip } from "./tooltip";
import "./icon-button.css";

export type IconButtonVariant = "float" | "strong" | "plain";

export interface IconButtonProps {
  /** What it does, for screen readers and the tooltip: "Rotate left". */
  label: string;
  icon: IconId;
  /** Its key, shown in the tooltip. */
  shortcut?: string;
  variant?: IconButtonVariant;
  /** 44 px (default) or 36 px. */
  size?: 44 | 36;
  /** A toggle: pressed (true) or not (false). Left out, it is a plain button. */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  onPress?: () => void;
  isDisabled?: boolean;
  tooltipPlacement?: "top" | "bottom" | "start" | "end";
}

export function IconButton(props: IconButtonProps) {
  const {
    label,
    icon,
    shortcut,
    variant = "float",
    size = 44,
    selected,
    onSelectedChange,
    tooltipPlacement,
    onPress,
    isDisabled,
  } = props;
  const shared = {
    onPress,
    isDisabled,
    "aria-label": label,
    className: "glade-icon-button",
    "data-variant": variant,
    "data-size": size,
  };
  const icon20 = <Icon id={icon} size={size === 36 ? 20 : 22} strokeWidth={2.6} />;
  const button =
    selected === undefined ? (
      <AriaButton {...shared}>{icon20}</AriaButton>
    ) : (
      <ToggleButton {...shared} isSelected={selected} onChange={onSelectedChange}>
        {icon20}
      </ToggleButton>
    );
  return (
    <Tooltip text={label} shortcut={shortcut} placement={tooltipPlacement}>
      {button}
    </Tooltip>
  );
}
