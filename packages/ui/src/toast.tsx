// Toast: a short note at the bottom of the screen, with one action, like "2 maps deleted · Undo".
// From the design: a dark pill with a selected-colour button. Read out politely (role="status").

import { Button } from "react-aria-components";
import "./toast.css";

export interface ToastProps {
  message: string;
  /** The one thing to do about it: "Undo". */
  action?: { label: string; onPress: () => void };
}

export function Toast(props: ToastProps) {
  return (
    <div className="glade-toast" role="status">
      <span>{props.message}</span>
      {props.action && (
        <Button className="glade-toast-action" onPress={props.action.onPress}>
          {props.action.label}
        </Button>
      )}
    </div>
  );
}
