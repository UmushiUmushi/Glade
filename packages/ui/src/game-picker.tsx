// The game picker: a dark pill with the current game's name in its own title font and a ▾, which
// opens a "Switch game" menu. Each game's name is in its own title font; games that aren't ready
// show "Soon" and can't be picked. From the design's side panel header.

import { Button as AriaButton } from "react-aria-components";
import { Icon } from "./icons";
import { Menu, MenuItem } from "./menu";
import "./game-picker.css";

export interface GameChoice {
  /** The game's id, as in its URLs. */
  id: string;
  /** Its name, as Glade shows it. */
  title: string;
  /** Its title font (a CSS font family); the current theme's title font when not given. */
  titleFont?: string;
  /** False for a game that isn't ready yet: shown as "Soon", not pickable. */
  ready: boolean;
}

export interface GamePickerProps {
  games: GameChoice[];
  /** The current game's id. */
  current: string;
  onPick: (id: string) => void;
}

export function GamePicker({ games, current, onPick }: GamePickerProps) {
  const here = games.find((g) => g.id === current);
  const title = here?.title ?? current;
  return (
    <Menu
      label="Switch game"
      width={250}
      selected={current}
      onSelectedChange={(id) => {
        if (id !== current) onPick(String(id));
      }}
      trigger={
        <AriaButton className="glade-game-picker" aria-label={`Game: ${title}. Switch game`}>
          <span className="glade-game-picker-title" style={{ fontFamily: here?.titleFont }}>
            {title}
          </span>
          <Icon id="chevron-down" size={20} strokeWidth={2.8} />
        </AriaButton>
      }
    >
      {games.map((g) => (
        <MenuItem
          key={g.id}
          id={g.id}
          titleFont={g.titleFont ?? "var(--font-title)"}
          badge={g.ready ? undefined : "Soon"}
          isDisabled={!g.ready}
        >
          {g.title}
        </MenuItem>
      ))}
    </Menu>
  );
}
