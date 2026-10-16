// Dialog: a window over the screen that asks for something (role="dialog"). From the design: a
// 400 px popup card over a dim backdrop, a title, and a round dark close button. Esc closes it,
// and focus stays inside until it does.

import type { ReactNode } from "react";
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { IconButton } from "./icon-button";
import "./dialog.css";

export interface DialogProps {
  title: string;
  /** A line under the title (the map's name). */
  subtitle?: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children: ReactNode;
  /** Width in CSS pixels (the design uses 400). */
  width?: number;
  /** Close by clicking the backdrop. Off for dialogs that guard unsaved work. */
  dismissable?: boolean;
}

export function Dialog(props: DialogProps) {
  return (
    <ModalOverlay
      className="glade-dialog-backdrop"
      isOpen={props.isOpen}
      onOpenChange={props.onOpenChange}
      isDismissable={props.dismissable ?? true}
    >
      <Modal className="glade-dialog-modal" style={{ width: props.width ?? 400 }}>
        <AriaDialog className="glade-dialog">
          {({ close }) => (
            <>
              <div className="glade-dialog-head">
                <div className="glade-dialog-titles">
                  <Heading slot="title" className="glade-dialog-title">
                    {props.title}
                  </Heading>
                  {props.subtitle && (
                    <span className="glade-dialog-subtitle">{props.subtitle}</span>
                  )}
                </div>
                <IconButton label="Close" icon="close" variant="strong" size={36} onPress={close} />
              </div>
              {props.children}
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
