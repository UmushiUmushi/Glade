// Button: a round-ended button with a word on it, and an optional icon before the word.
// primary: the selected colour (Log in, Show items). secondary: the floating colour (Cancel).
// strong: the dark fill. danger: Delete. quiet: no fill (menu-like rows).

import type { ReactNode } from "react";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { Icon, type IconId } from "./icons";
import "./button.css";

export type ButtonVariant = "primary" | "secondary" | "strong" | "danger" | "quiet";

export interface ButtonProps extends Omit<AriaButtonProps, "children" | "className" | "style"> {
  variant?: ButtonVariant;
  /** 44 px tall (default) or 36 px. */
  size?: "md" | "sm";
  icon?: IconId;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  children,
  ...rest
}: ButtonProps) {
  return (
    <AriaButton {...rest} className="glade-button" data-variant={variant} data-size={size}>
      {icon && <Icon id={icon} size={18} strokeWidth={2.6} />}
      <span>{children}</span>
    </AriaButton>
  );
}
