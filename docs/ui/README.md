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

Each game sets **design tokens** in its `ui` package (`@glade/<id>-ui`) as a `Theme` (light and dark
colours, shapes, fonts). Shared screens only use tokens, never raw colours, so every game gets its
own look with the same controls. Token names say what a colour is **for**, not what it looks like,
so they fit every game: `--selected`, not "sun". The names live in `packages/ui/src/theme/tokens.ts`.

| Token group | Examples                                                | Petit Planet                                                                                                         |
| ----------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Colours     | `--ground`, `--paper`, `--ink`, `--selected`, `--alert` | Warm cream cards on a tan tray. Cocoa is the one dark fill. Sun yellow means "selected". Light and dark.             |
| Fonts       | `--font-title`, `--font-ui`, `--weight-ui`              | Baloo 2 (titles, weight 800) and Nunito (UI, 700–900). Nothing lighter than 700.                                     |
| Shape       | `--radius-card`, `--border-card`, `--lip`, `--gap`      | Three cards (panel, viewport, toolbox) on the tray: 28 px corners, 3 px border, a solid 5 px bottom lip, 12 px gaps. |
| Icons       | Icon map: the icons the game draws itself               | Hand-drawn complex icons ([icons](#icons-and-cursors)); generic icons from the shared open-source set                |

Glade also has its own plain theme (`gladeTheme` in `@glade/ui`): calm greys and the system's
fonts, for screens where no game is picked (the home page).

**Petit Planet colours**

| Token                            | Light                 | Dark                  | Used for                                  |
| -------------------------------- | --------------------- | --------------------- | ----------------------------------------- |
| `ground`                         | `#e9e4cc`             | `#0e0d0c`             | The tray behind the cards                 |
| `paper`                          | `#fcf9e8`             | `#1c1a19`             | Cards                                     |
| `inset`                          | `#efe9d4`             | `#2a2725`             | Wells, tabs, slider tracks                |
| `line`                           | `#d6cdaa`             | `#3a3532`             | Dotted dividers                           |
| `ink`                            | `#3d3632`             | `#f5f0d1`             | Text and glyphs                           |
| `ink-title`                      | `#614c32`             | `#e8dcb4`             | Titles                                    |
| `ink-muted`                      | `#6e6245`             | `#b5ada0`             | Secondary text                            |
| `frame`                          | `#d6cdaa`             | `#2c2826`             | Card borders                              |
| `lip`                            | `rgba(61,54,50,.16)`  | `#3e3833`             | Card bottom edge                          |
| `pop` / `pop-line`               | `#efe6c8` / `#d6cdaa` | `#2d2a27` / `#45403b` | Popups and menus                          |
| `alert`                          | `#a8372a`             | `#ff9a85`             | Problems: alert discs and text            |
| `strong` / `on-strong` (cocoa)   | `#3d3632` / `#f5f0d1` | same                  | Dark buttons, info pills, toasts          |
| `float` / `on-float` (cream)     | `#efe9d4` / `#3d3632` | same                  | Buttons floating on the map               |
| `float-press`                    | `#e2dcc4`             | same                  | The stepper's buttons inside a float pill |
| `selected` / `on-selected` (sun) | `#f9e260` / `#3d3632` | same                  | The selected state; the primary button    |
| `danger` / `on-danger`           | `#a8372a` / `#f5f0d1` | same                  | Delete                                    |
| `scrim`                          | `rgba(36,30,26,.38)`  | same                  | Behind a dialog                           |

Things that float on the map (cream buttons, cocoa, sun) keep their colours in both themes. Ink is
never pure black.

Rules:

- Text contrast at least 4.5 : 1, for every text colour on what it sits on (`contrastProblems` in
  `@glade/ui`, checked for every game's theme).
- Focus ring is always visible and high contrast, in every theme.
- No game assets (fonts, images, sounds) taken from the game. Fonts are open fonts; icons and
  models are original work.

## Icons and cursors

All icons, cursors and artwork in Glade are drawn by people, not by AI.

Icons come from two places:

1. **The shared set.** `@glade/ui` holds a standard open-source icon set. It has an icon for every
   icon id the shared screens use, so a game works with no icons of its own.
2. **The game's own.** A game's `ui` package can draw its own version of any icon, as an SVG file
   in `theme/icons/` (like `Grab.svg`). Its icon map lists the icons it replaces. Every other icon
   comes from the shared set.

Each game chooses per icon. The rule of thumb: a game draws its complex, characterful icons (the
glove, plants, items) and takes generic icons (close, undo, eye, search) from the shared set.

| Icons                                                       | Petit Planet                                       | A game that draws few icons (likely Palworld) |
| ----------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------- |
| Tools (Camera uses the Grab glove, Pointer)                 | Hand-drawn, in `ui/theme/icons/`                   | Shared set                                    |
| Select tools, viewport modes, layers, paint tools           | Hand-drawn, same place                             | Shared set                                    |
| Plants and items                                            | Hand-drawn, same place                             | Shared set                                    |
| Generic: menu, close, chevrons, undo and redo, eye, search… | Shared set                                         | Shared set                                    |
| Paint tool cursors                                          | From the paint tool icons                          | From the paint tool icons                     |
| Camera, Pointer and select cursors                          | The browser's own (`grab`, `default`, `crosshair`) | The browser's own                             |

A contract test checks that every icon id a screen uses resolves, to the game's drawing or to the
shared set.

**Redrawing an icon.** Each of Petit Planet's drawings is a file in
`packages/games/petit-planet/ui/theme/icons/` (`Grab.svg`, `LayerPlants.svg`…). Save over the file
and its id stays the same, so every screen picks up the new drawing. Storybook's **Petit Planet →
Icons** page shows every drawing with its id and file name, in light and dark. A drawing that should change
colour with the theme fills (or strokes) with `currentColor`: it then takes the text colour, dark on
light cards, light on dark cards, and the right colour on a selected button. `Grab.svg` does this.
A drawing can also keep colours of its own (the mode icons do); check it shows on both the light
and the dark cards. The game's tests check every file
is in the icon map and is a safe SVG (no scripts, no links to outside files). How cursors behave: [the planner screen](../planner/screen.md#tools).

## Seeing the controls

`pnpm storybook` opens Storybook: every control with its states. The toolbar switches the theme
(Glade, or a game's) and light or dark. Each story's play steps and an accessibility check (axe) run
as tests in Chromium with `pnpm test`.

## Where UI code lives

| What                                                     | Package          |
| -------------------------------------------------------- | ---------------- |
| Tokens, controls (buttons, sliders, menus), shared icons | `@glade/ui`      |
| The planner's screens (side panel, rail, problems chip)  | `@glade/planner` |
| The builder's screens                                    | `@glade/builder` |
| One game's theme, icons and words                        | `@glade/<id>-ui` |

See also [accessibility](accessibility.md).
