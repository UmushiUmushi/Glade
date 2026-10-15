# UI principles and themes

> **In short:** Show, don't hide. Forgive mistakes. Explain, don't just block. Same feel in every
> game. Everything works by mouse, touch and keyboard. Each game brings its own theme; the
> controls stay the same.

## UX principles

| #   | Principle                     | What it means in Glade                                                                                |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | **Direct**                    | Grab a thing and move it. No "edit mode" first.                                                       |
| 2   | **Always visible state**      | The active tool, mode and selection type are always highlighted, even in the rail.                    |
| 3   | **Forgiving**                 | Everything can be undone. Bad drops snap back. `Esc` cancels.                                         |
| 4   | **Explain, don't just block** | Every violation says what broke, where, and how to fix it, in plain words.                            |
| 5   | **Everything has a name**     | Hover or focus any control and its name shows. On touch, a tap shows it.                              |
| 6   | **Same feel in every game**   | Same places, same keys. Only the look and the game tools change.                                      |
| 7   | **Progressive**               | Simple first. Extra options sit in menus and flyouts.                                                 |
| 8   | **Every input**               | Mouse, touch, pen and keyboard can do every task.                                                     |
| 9   | **Fast feedback**             | Visual reply within 100 ms. Longer work shows progress.                                               |
| 10  | **Never lose work**           | Autosave, always: to the server, with the browser keeping unsent edits. Warn before anything is lost. |

## Game theme

Each game sets **design tokens** in its `ui` package (`@glade/<id>-ui`). Shared screens only use
tokens, never raw colours, so every game gets its own look with the same controls.

| Token group | Examples                                           | Petit Planet                                                                                                         |
| ----------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Colours     | `--ground`, `--paper`, `--ink`, `--sun`, `--alert` | Warm cream cards on a tan tray. Cocoa is the one dark fill. Sun yellow means "selected". Light and dark.             |
| Fonts       | `--font-title`, `--font-ui`                        | Baloo 2 (titles, weight 800) and Nunito (UI, 700–900). Nothing lighter than 700.                                     |
| Shape       | `--radius`, `--border`, `--lip`                    | Three cards (panel, viewport, toolbox) on the tray: 28 px corners, 3 px border, a solid 5 px bottom lip, 12 px gaps. |
| Icons       | Icon set id                                        | Hand-drawn game icons ([icons](#icons-and-cursors)) plus the shared open-source set                                  |

**Petit Planet colours**

| Token                | Light                 | Dark                  | Used for                                    |
| -------------------- | --------------------- | --------------------- | ------------------------------------------- |
| `ground`             | `#e9e4cc`             | `#0e0d0c`             | The tray behind the cards                   |
| `paper`              | `#fcf9e8`             | `#1c1a19`             | Cards                                       |
| `inset`              | `#efe9d4`             | `#2a2725`             | Wells, tabs, slider tracks                  |
| `line`               | `#d6cdaa`             | `#3a3532`             | Dotted dividers                             |
| `ink`                | `#3d3632`             | `#f5f0d1`             | Text and glyphs                             |
| `ink-brown`          | `#614c32`             | `#e8dcb4`             | Titles                                      |
| `ink-muted`          | `#6e6245`             | `#b5ada0`             | Secondary text                              |
| `frame`              | `#d6cdaa`             | `#2c2826`             | Card borders                                |
| `lip`                | `rgba(61,54,50,.16)`  | `#3e3833`             | Card bottom edge                            |
| `pop` / `pop-line`   | `#efe6c8` / `#d6cdaa` | `#2d2a27` / `#45403b` | Popups and menus                            |
| `alert`              | `#a8372a`             | `#ff9a85`             | Problems: alert discs and text              |
| `cocoa` / `on-cocoa` | `#3d3632` / `#f5f0d1` | same                  | Dark buttons and pills                      |
| `cream` / `sun`      | `#efe9d4` / `#f9e260` | same                  | Buttons floating on the map; selected state |

Things that float on the map (cream buttons, cocoa, sun) keep their colours in both themes. Ink is
never pure black.

Rules:

- Text contrast at least 4.5 : 1 (checked in tests).
- Focus ring is always visible and high contrast, in every theme.
- No game assets (fonts, images, sounds) taken from the game. Fonts are open fonts; icons and
  models are original work.

## Icons and cursors

All icons, cursors and artwork in Glade are drawn by people, not by AI.

| Icons                                                               | Where they come from                                    |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| Tools (Camera uses the Grab icon, Pointer)                          | Hand-drawn, in the game's `ui` package (`theme/icons/`) |
| Select tools (Lasso, Rectangle, Circle, Magic)                      | Hand-drawn, same place                                  |
| Layers                                                              | Hand-drawn, same place                                  |
| Viewport mode buttons                                               | Hand-drawn, same place                                  |
| Paint tools (Brush, Eraser, Fill, Cut) and their cursors            | Hand-drawn, same place                                  |
| Everything else: menu, close, chevrons, undo and redo, eye, search… | A standard open-source icon set in `@glade/ui`          |
| Camera, Pointer and select cursors                                  | The browser's own (`grab`, `default`, `crosshair`)      |

How cursors behave: [the planner screen](../planner/screen.md#tools).

## Where UI code lives

| What                                                     | Package          |
| -------------------------------------------------------- | ---------------- |
| Tokens, controls (buttons, sliders, menus), shared icons | `@glade/ui`      |
| The planner's screens (side panel, rail, problems chip)  | `@glade/planner` |
| The builder's screens                                    | `@glade/builder` |
| One game's theme, icons and words                        | `@glade/<id>-ui` |

See also [accessibility](accessibility.md).
