# The planner screen

> **In short:** Left: the side panel (shared by all games). Right: the viewport (the map) with the toolbox under it. The panel can shrink to a thin rail that still does everything. On phones, the panel becomes a top bar and the toolbox becomes a bottom sheet.

## Layouts

### Desktop

| Part                         | Section                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| Menu                         | [Menu, game picker, settings, guide](#menu-game-picker-settings-guide) |
| Game picker                  | [Menu, game picker, settings, guide](#menu-game-picker-settings-guide) |
| Tools (Camera, Pointer)      | [Tools](#tools)                                                        |
| Select tools and modes       | [Select](#select)                                                      |
| Environment: time and snow   | [Environment](#environment)                                            |
| Layers                       | [Layers](#layers)                                                      |
| Collapse panel               | [The rail (collapsed panel)](#the-rail-collapsed-panel)                |
| Viewport modes               | [Viewport mode buttons (top left)](#viewport-mode-buttons-top-left)    |
| Undo and redo                | [Undo and redo](#undo-and-redo)                                        |
| Problems chip and tray       | [Problems](#problems)                                                  |
| Save status and share chip   | [Save status and sharing](#save-status-and-sharing)                    |
| Viewport menu                | [Viewport menu (top right)](#viewport-menu-top-right)                  |
| Selection bar                | [Selection bar and actions menu](#selection-bar-and-actions-menu)      |
| Hovered item                 | [Highlights](#highlights)                                              |
| FPS and coordinates          | [FPS and coordinates (bottom left)](#fps-and-coordinates-bottom-left)  |
| Toolbox tabs and search      | [Toolbox](#toolbox)                                                    |
| New item (opens the builder) | [Items mode: the item drawer](#items-mode-the-item-drawer)             |
| Item cards                   | [Items mode: the item drawer](#items-mode-the-item-drawer)             |

### Screen sizes

| Screen                | How Glade decides                                       | Side panel                      | Toolbox                                          |
| --------------------- | ------------------------------------------------------- | ------------------------------- | ------------------------------------------------ |
| Desktop               | Width ≥ 1280 px                                         | Expanded (can collapse)         | Docked under the viewport, height can be dragged |
| Tablet / small laptop | Width 900–1279 px, or a large touch screen in landscape | Starts as the rail (can expand) | Docked under the viewport                        |
| Phone                 | Width < 900 px, or height < 500 px                      | Top bar, always minimised       | Bottom sheet over the viewport                   |

The user can force a layout in Settings: **Auto**, **Desktop**, **Phone portrait**, **Phone landscape**.

### Phone

| Part           | Where                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top bar        | Along the top. Menu and game picker stay pinned on the left. The rest scrolls sideways: tools, select, clear, ruler, time, snow, layers, always-on. |
| Viewport menu  | On the right. It can still collapse into a slim tag.                                                                                                |
| Undo and redo  | Under the viewport menu.                                                                                                                            |
| Viewport modes | A row of buttons riding just above the toolbox sheet, on the left.                                                                                  |
| FPS and coords | On the right of that same row.                                                                                                                      |
| Toolbox        | A bottom sheet over the viewport. It can collapse: tap or drag the handle. Size and cut type sit on rows below the tools.                           |

- Tap replaces hover: tap an icon to see its name and its flyout.
- Long press opens the actions menu for a selection or item.
- Portrait and landscape use the same parts.

## Side panel (expanded)

**Rules for the whole panel**

- Width 336 px. Everything is left aligned.
- Sections are split by dotted lines.
- The header (Menu, game picker, Minimize) is **pinned**. The rest scrolls if the window is short.
- Each section heading is a real heading for screen readers (`h2`).
- Each group of buttons is a **toolbar**: `Tab` enters it, arrow keys move inside it.
- Tool buttons: idle = icon only; active = the icon in a sun-yellow circle.

### Header

| Control     | Looks like                                           | Does                                                                                                                               |
| ----------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Menu        | Round dark button                                    | Opens the main menu ([Menu, game picker, settings, guide](#menu-game-picker-settings-guide)).                                      |
| Game picker | Dark pill with the game's title in its title font, ▾ | Lists games, each title in its own font. Games not ready yet show "Soon". Picking one saves the map and opens that game's planner. |
| Minimize    | Round dark button                                    | Shrinks the panel to the rail ([The rail](#the-rail-collapsed-panel)).                                                             |

### Tools

| Control        | Does                                                                                                                                                                      | Key     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **Camera**     | Left-drag orbits the camera around the centre of the view (3D) or pans (2D).                                                                                              | `H`     |
| **Pointer**    | Click picks the thing in the cell (based on the viewport mode). In Paths, Cliffs and Water, a click picks the **whole connected piece**. Drag a thing to move it at once. | `V`     |
| Right-click    | With the Pointer: if something is selected, opens its actions menu. If not, selects what is under the cursor, then opens its menu.                                        | —       |
| Hold **Shift** | Swaps Camera ↔ Pointer while held. Let go to go back.                                                                                                                     | `Shift` |

While Shift is held, the swapped tool shows highlighted with a small "held" dot.

**One tool at a time.** Camera, Pointer, the 4 select tools and the paint tools (Brush, Eraser, Fill,
Cut) share one "active tool". Picking one puts the last one down.

- Clicking the active Camera, Pointer or select tool again does nothing.
- Clicking the active Brush, Eraser, Fill or Cut again puts it down and goes back to the Pointer.

**Cursors**

| Tool                        | Cursor                                                              |
| --------------------------- | ------------------------------------------------------------------- |
| Camera                      | The browser's `grab`, and `grabbing` while dragging                 |
| Pointer                     | The browser's `default`; `not-allowed` over a thing that can't move |
| Select tools                | The browser's `crosshair`                                           |
| Brush · Eraser · Fill · Cut | Drawn cursors: a paintbrush, an eraser, a fill bucket, scissors     |

Camera, Pointer and select tools use the browser's own cursors. Browsers and operating systems
have no brush, eraser, bucket or scissors cursors, so those four are drawn, in the game's `ui`
package: 32 × 32 px, the hot spot at the tool's tip, a light outline so they show on dark and light
ground, and `crosshair` as the fallback (`cursor: url(brush.svg) 3 29, crosshair`).

### Select

One row: 4 tools on the left, 3 modes on the right.

| Control                    | Does                                                                                                                           | Key               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| **Lasso**                  | Draw any shape. Selects what is inside.                                                                                        | `L`               |
| **Rectangle**              | Drag a box.                                                                                                                    | `M`               |
| **Circle**                 | Drag a circle from its centre.                                                                                                 | `O`               |
| **Magic**                  | Click to select everything connected (flood).                                                                                  | `Y`               |
| **Set**                    | New selection replaces the old one.                                                                                            | —                 |
| **Add**                    | New selection joins the old one.                                                                                               | hold `Ctrl` / `⌘` |
| **Subtract**               | New selection is removed from the old one.                                                                                     | hold `Alt` / `⌥`  |
| **Clear selection** (pill) | Clears the selection.                                                                                                          | `Esc`             |
| **Ruler** (tick box)       | Shows measure bars on the selection: width above it, height on its left. Tiles in Items and Paths, blocks in Cliffs and Water. | `R`               |

What each tool selects depends on the viewport mode ([Selecting](behaviour.md#selecting)).

### Environment

| Control                         | Does                                                                                                                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Time slider**                 | Sets the time of day. Snaps to 4 key points (the hours come from the game's look, the names from its `ui` package): Dawn 7:00, Day 12:00, Dusk 16:30, Night 21:00. You can also stop between them; the look blends.                       |
| **Sky dome** (above the slider) | A small dome of sky. The sun travels along its arc as you slide and becomes a moon at night. Clouds by day turn into stars at night. A skyline silhouette stands in front of the sun. Sky colours come from the game's look at that hour. |
| **Snow** (tick box)             | Turns on winter (season `winter`).                                                                                                                                                                                                        |

A map type with a fixed look (one preset, no seasons, like a home) hides this whole section, in the panel and the rail.

**Slider details**

- Range: 7:00 to 21:00.
- Magnet zone: within 0.75 hours of a key point, it snaps there.
- Keyboard: `←` `→` move 15 minutes. `Page Up` / `Page Down` jump to the next key point. `Home` / `End` go to the ends.
- Screen readers hear: "Time of day, Dusk, 4:30 PM".

### Layers

| Row             | Shows / hides                          | Profile layer toggle         |
| --------------- | -------------------------------------- | ---------------------------- |
| Buildings       | Items of kind `building`               | `items` (needs T-1 to split) |
| Furniture       | All other items, bridges, inclines     | `items`                      |
| Plants          | Trees, bushes, flowers, crops          | `plants`                     |
| Paths           | Paths                                  | `paths`                      |
| Grid            | Cell lines for the current mode's grid | host grid lines              |
| Area            | Area lines and labels (16 × 16 tiles)  | host area grid               |
| Always on: Area | Tick box                               | —                            |
| Always on: Grid | Tick box                               | —                            |

Each row has an eye button. Clicking the row name also toggles it.

**Hiding only hides.** A hidden layer is still on the map and still counts for every rule and tool.
Example: with Furniture hidden, you still can't place a chair where a hidden table stands, and the
problems chip says why.

**How "Always on" works**

| Always on: Grid | Grid row                             | What you see                                                                                                                         |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| ✅ Ticked       | Enabled. Its eye works.              | Eye open: grid everywhere. Eye closed: no grid.                                                                                      |
| ⬜ Not ticked   | Disabled (greyed). Tooltip says why. | **Grid spotlight**: the grid shows only under the hovered, picked or dragged thing, about 3 tiles around it, fading out at the edge. |

| Always on: Area | Area row                | What you see                                                                |
| --------------- | ----------------------- | --------------------------------------------------------------------------- |
| ✅ Ticked       | Enabled. Its eye works. | Eye open: all area lines and labels. Eye closed: none.                      |
| ⬜ Not ticked   | Disabled (greyed).      | Only the **active area** shows: the area under the cursor or the selection. |

## The rail (collapsed panel)

The rail is 76 px wide. **Everything in the panel still works from the rail.**

| Rail item   | Shows                                                                      | Hover / focus / tap                                                            |
| ----------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Menu        | Round dark button                                                          | Opens the Menu.                                                                |
| Game        | Game's small logo                                                          | Opens the game picker.                                                         |
| Tools       | The active tool (Camera or Pointer). Changes while Shift is held.          | Click swaps tools. Flyout shows both.                                          |
| Select tool | The last select tool used, with a small badge for the mode (`=`, `+`, `−`) | Click activates the select tool it shows. Hover shows the 4 tools and 3 modes. |
| Clear       | Deselect icon                                                              | Clears the selection.                                                          |
| Ruler       | Ruler icon, filled when on                                                 | Toggles the ruler.                                                             |
| Time        | One of 4 icons: sunrise, sun, sunset, moon                                 | Flyout shows just the slider.                                                  |
| Snow        | Snowflake, filled when on                                                  | Toggles snow.                                                                  |
| Layers      | One icon per layer: a filled disc when visible, outlined when hidden       | Click toggles.                                                                 |
| Always on   | Area icon and grid icon, filled when on                                    | Click toggles.                                                                 |
| Expand      | The Minimize button, turned around                                         | Opens the full panel.                                                          |

Flyouts open on hover after 300 ms, or at once on click, tap or keyboard focus. `Esc` closes them.

## Phone top bar

- Height 52 px. Same items as the rail, in a row.
- **More** and **Game** stay pinned on the left. The rest scrolls sideways. A soft fade on the right edge shows there is more.
- Tap replaces hover: tap an icon to see its name and its flyout. Tap again to use it.
- Flyouts drop down under the bar.

## Viewport

The viewport shows the map in 2D or 3D. It fills all space right of the panel and above the toolbox. On phones it fills the screen under the top bar.

### Viewport mode buttons (top left)

| Mode       | Grid used                            | Scope (what tools touch)                     | Other things                                                  |
| ---------- | ------------------------------------ | -------------------------------------------- | ------------------------------------------------------------- |
| **Items**  | Base: half-tile snapping, tile lines | Houses, furniture, plants, bridges, inclines | —                                                             |
| **Paths**  | Base: tiles                          | Paths only                                   | Items and plants turn see-through, so you can see under them. |
| **Cliffs** | Terrain: blocks                      | Land (heights) and what stands on it         | —                                                             |
| **Water**  | Terrain: blocks                      | Water and what stands on it                  | —                                                             |

Keys: `1` Items, `2` Paths, `3` Cliffs, `4` Water.

The buttons' icons sit in a pill. Unselected: icon only. Selected: a sun-yellow pill, a bigger
icon and the mode's name below. On phones they sit in a row above the toolbox.

**Home modes (after 1.0).** A home has its own modes. Same keys, same places.

| Mode        | Key | Grid used                       | Scope (what tools touch)                                                                 |
| ----------- | --- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| **Floor**   | `1` | Half tiles on the floor         | Floor items, and things on their tables                                                  |
| **Walls**   | `2` | Half cells across and up a wall | Wall items. The camera turns to face the wall you work on.                               |
| **Ceiling** | `3` | Half tiles on the ceiling       | Ceiling items. The view is from below.                                                   |
| **Decor**   | `4` | Rooms                           | Wallpaper and flooring for each room. The toolbox shows swatches, like the path palette. |

### Undo and redo

- Desktop: next to the mode buttons.
- Phone: on the right, under the viewport menu.
- Disabled (greyed) when there is nothing to undo or redo. The tooltip says what will be undone: "Undo: move 3 chairs".

### Viewport menu (top right)

The top-right corner holds, left to right: the share chip, the problems chip, the viewport menu.

| Row                 | Does                                                                                                                                  | Key   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 👁 Preview           | Hides all panels and controls. The map fills the screen. Only a closed-eye button stays, top right. Click it (or `Esc`) to come back. | `P`   |
| 2D / 3D             | Switches view. Hidden when the map type has only one view.                                                                            | `Tab` |
| View mode (3D only) | Iso, Top or Walk. Click to see the 3 options.                                                                                         | —     |
| Fit                 | Moves the camera to the default view for 2D or 3D. With a selection, fits the selection.                                              | `F`   |
| Collapse            | The menu folds into a slim tag of the same height, with a left-pointing chevron.                                                      | —     |

### FPS and coordinates (bottom left)

Example: `60 fps · Tile 34.5, 40 · Area C3`

| Mode          | Coordinates shown                         |
| ------------- | ----------------------------------------- |
| Items         | Tile, in half steps: `Tile 34.5, 40`      |
| Paths         | Tile: `Tile 34, 40`                       |
| Cliffs, Water | Block and level: `Block 34, 40 · Level 3` |

The coordinates follow the selected cell. With no selection, they follow the cursor. FPS can be hidden in Settings. On phones it sits right of the mode buttons, above the toolbox.

### Highlights

| State                                                               | Look                                                | Not colour alone                |
| ------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------- |
| Hover                                                               | Yellow outline (`#F2B705`)                          | Outline gets thicker            |
| Selected                                                            | Blue outline and soft glow (`#2F7DF6`)              | Dashed edge for area selections |
| Invalid (while moving)                                              | Red outline (`#E03131`) + ⚠ yellow alert icon above | Icon + diagonal stripes         |
| Cells causing a violation                                           | Flash red 3 times                                   | Flashing outline                |
| Temporary terrain ([Shaping terrain](behaviour.md#shaping-terrain)) | See-through purple with stripes                     | Stripes                         |
| Just changed                                                        | Short soft flash                                    | —                               |

Settings has 2 extra colour sets for colour blindness (deuteranopia, tritanopia).

Every selection also gets the [selection bar](#selection-bar-and-actions-menu).

## Problems

Problems never cover the map. They gather in a small **problems chip** in the top-right corner of
the viewport, between the share chip and the viewport menu.

| Part           | Detail                                                                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chip           | An alert disc and the count of messages. Hidden when there are none.                                                                                                                                                              |
| Peek           | A new message widens the chip for 4 seconds to show its title, then it shrinks back. It stays wide while the pointer is over it, and shrinks 1.5 s after it leaves. Settings → Appearance → **Peek new problems** turns this off. |
| Tray           | Click the chip: a tray drops down under it, listing each message. **Dismiss all** and a close `X` at the top.                                                                                                                     |
| A message      | Title, then **Details** (the plain explanation and a fix tip), **Show me** (the camera goes there, the cells flash) and **Dismiss**.                                                                                              |
| Two kinds      | **Problems**: a rule the change broke (red alert disc). **Notes**: something that worked but needs saying, like "12 blocks skipped: under items" (blue info disc).                                                                |
| Repeats        | The same rule again counts up on the same message ("×3") instead of adding another.                                                                                                                                               |
| How long       | A message closes by itself after 8 seconds unless the tray is open; at most 6 are kept.                                                                                                                                           |
| Screen readers | The chip's name reads the newest title and the count: "New: Too steep. 2 messages. Show details". New messages are announced politely.                                                                                            |
| Keyboard       | `F8` opens the tray and focuses the newest message. `Esc` closes it.                                                                                                                                                              |

Message text comes from the game's `ruleText` table, in its `ui` package ([Petit Planet's](../profiles/petit-planet.md#friendly-rule-text)).

## Save status and sharing

| Part        | Where                               | Detail                                                                                                                                                    |
| ----------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save status | Top left, after Undo and Redo       | "Saved", "Saving…" or "Couldn't save". Its tooltip says where the map lives ("on this device" until accounts exist).                                      |
| Share chip  | Top right, before the problems chip | Private, Public, or Public with changes not shared yet (✱). Click it to open the share dialog ([sharing](../server/sharing.md#share-a-map-step-by-step)). |

### Someone else's map (view only)

Opening a shared link that isn't yours shows the map with its view controls only: select, ruler,
looking at items, environment and layers. The toolbox and every editing control are gone. A **view
bar** along the top has a "View only" tag, **Make a copy** (it goes in your Library as a draft) and
a `⋯` menu with the version ("Version 4 · shared 2 hours ago") and **Report map**. Your own shared
version reads "Your shared version · View only", and its main button is **Open my draft**.

## Selection bar and actions menu

Every selection, in every mode, gets the same small bar floating above it:

| Button         | Does                                                                               | Key           |
| -------------- | ---------------------------------------------------------------------------------- | ------------- |
| ⟲ Rotate left  | Turns the selection 90° ([rotating](behaviour.md#rotate))                          | `[`           |
| ⟳ Rotate right | Turns it the other way                                                             | `]`           |
| 🗑 Delete       | Deletes it ([what delete does per mode](behaviour.md#copy-paste-duplicate-delete)) | `Delete`      |
| ••• More       | Opens the actions menu                                                             | `Shift + F10` |

Right-click and long-press also open the actions menu. The menu has a title and a close `X`.

| Selection       | Actions menu                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| Item            | Create new (opens the builder with a copy) · Search similar · Copy · Paste                            |
| Cliff           | **Raise / lower** (first) · Copy · Paste · **Select ground too** (last, only when cliffs were picked) |
| Pond (water)    | **Raise / lower** (first) · Copy · Paste                                                              |
| Path            | Copy · Paste                                                                                          |
| Empty selection | Paste                                                                                                 |

**Raise / lower control:** a vertical slider. 0 in the middle is the selection's height now, and
the slider snaps back to 0 after use. Up raises, down lowers, 1 level per notch. The top end is the
highest the selection can go; the bottom end is the lowest. The map preview updates as you slide,
with any terraces it needs. Letting go commits it as one undo step.

## Toolbox

Desktop: under the viewport. Its height can be dragged (min 140 px, max half the window).
Phone: a bottom sheet over the viewport. Drag its handle to open or close it.

The toolbox **changes with the viewport mode**. It remembers the last tool, path type and item for each mode.

### Items mode: the item drawer

The top row, left to right: search, category tabs, Sort, Filter, the item count. Under it: the
**New Item** tile, then the item cards.

| Part           | Detail                                                                                                                                                                                                                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search         | A round button; click (or `/`) and it grows into a field about 60 % of the row. Matches name, kind, id, category and tags, ignoring tabs. Typo-tolerant.                                                                                                                                                                                           |
| Tabs           | **All**, then the game's own categories, one level (Petit Planet: Basic Furniture, Functional, Interior Fixtures, Decorations, Greenery, Outdoor, Facilities, Plants, Other). The row scrolls sideways and fades at its right edge.                                                                                                                |
| Sort           | A menu that opens upward: Name A–Z, Newest first, Biggest first, Pack.                                                                                                                                                                                                                                                                             |
| Filter         | A 288 px panel that opens upward, with no dimmed backdrop: a **Water decor** switch, chip groups for **Trait**, **Material** and **Pack** (from the game's `ui` package), and a pinned footer with **Clear all** and **Show N items**. Changes are drafts until **Show N items**. With filters on, the button turns sun yellow and shows how many. |
| Item count     | "19 items", or "3 items match" when filtered.                                                                                                                                                                                                                                                                                                      |
| **New Item**   | The first tile. Opens a blank builder.                                                                                                                                                                                                                                                                                                             |
| Cards          | Thumbnail and name. Items that can go on water have a small sky-blue badge with three wavy lines in the top-left corner. Footprint shown on hover ("1 × 2 tiles").                                                                                                                                                                                 |
| Drag a card    | Drag it into the viewport. A see-through copy follows the cursor and snaps to the grid. It turns red if it can't go there. `[` and `]` rotate while dragging.                                                                                                                                                                                      |
| Click a card   | Highlights it and shows `•••` at its top right. Then click on the map to place it (repeat to place more). `Esc` stops placing.                                                                                                                                                                                                                     |
| Card `•••`     | **Create new** (open in builder as a copy) · **Search similar**.                                                                                                                                                                                                                                                                                   |
| Search similar | Puts the item's kind or category into the bar as a chip, like `kind: fence`, and searches. A kind chip also finds sub-kinds: `kind: plant` finds trees, shrubs and flowers.                                                                                                                                                                        |
| What shows     | Only items the open map type takes. The island hides wall and ceiling items, wallpaper and flooring. Glade asks the profile (`excludedBy`), so no item needs an "indoor" or "outdoor" tag.                                                                                                                                                         |

There is no tag filter: tags are free words, so search covers them.

### Paths mode

A row of tools on top, a palette of path types below.

| Tool       | Does                                                                                                                                                                                                                      | Key |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| **Brush**  | Paint the chosen path.                                                                                                                                                                                                    | `B` |
| **Eraser** | Remove paths.                                                                                                                                                                                                             | `X` |
| **Fill**   | Pick a path type in the palette, then click the selection or connected path tiles.                                                                                                                                        | `G` |
| **Cut**    | Choose **Round** or **Clip**, then click an exposed corner of a piece at least 2 tiles long (a game rule). Allowed corners show small dots on hover. Clicking a corner that already has that shape makes it square again. | `T` |

- **Size:** a slider from 1 to 5 appears right of Cut, only while Brush or Eraser is active.
- **Cut type** (Round / Clip) appears there while Cut is active.
- On phones, size and cut type sit on rows below the tools.

The palette shows each path type as a swatch with its pattern (cobble or plain) and name.

### Cliffs and Water modes

Same tools, no Fill, no drawer. Blocks a stroke can't change get red stripes and a message in the problems chip ([brush and eraser](behaviour.md#brush-and-eraser-one-layer)).

| Tool   | Cliffs                                                                                                                         | Water                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| Brush  | Raises the stroke's level by one: only blocks at the level where you pressed. Other levels are borders. Setting: size (width). | Adds water on dry blocks at the stroke's level. Setting: size. |
| Eraser | Lowers the stroke's level by one, the same way.                                                                                | Removes water at the stroke's level.                           |
| Cut    | Choose Round or Clip, then click an exposed cliff corner (half a block).                                                       | The same, for water corners.                                   |

## Menu, game picker, settings, guide

### Menu

The round Menu button opens a panel in three parts.

| Part    | Holds                                                                                                                                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App row | Four round buttons: **Home** (goes to `/`), **Settings**, **Guide**, **Report an issue** (the issue form, [bug reports](../logging/README.md#sending-a-bug-report); not the same as **Report map** on someone's shared map). |
| Account | Logged in: who you are, **Library** (Maps · Packs) and **Log out**. Logged out: **Log in** with "Log in to save, share and keep your Library", and **Library**.                                                              |
| Map     | The map's name, then three tiles: **New** (a fresh map; the current one is already saved), **Save As** (a named copy; changes save by themselves), **Share** ([sharing](../server/sharing.md#share-a-map-step-by-step)).     |

There is no Save button: maps save as you work. When a game has more than one map type, **New** asks
which ("Island" or a home layout). In 1.0 only the island is offered. All items are for the current
game only.

### Settings window (tabs)

Tabs down the left. Changes apply at once.

| Tab         | Options                                                                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account     | Who you're signed in as (or **Log in**) · **Download my data** · **Delete my account** (type your username to confirm) ([accounts](../server/accounts.md)) |
| Appearance  | Theme: Light, Dark, Match system · **Interface size** (70 % to 130 %) · Show FPS counter · Show coordinates · Peek new problems · Reduce motion            |
| Keybindings | Every shortcut, by group. Click one, then press the new key; `Esc` cancels. **Reset to defaults**.                                                         |
| Debugging   | The log viewer · **Attach logs when I report an issue** · Download log                                                                                     |
| About       | Version and build · links: GitHub, licence, privacy policy, report an issue, Ko-fi                                                                         |

Options the docs need that the design doesn't show yet are an open question in the
[roadmap](../roadmap.md#open-questions) (Q-30): dyslexia-friendly font, high contrast, colour-blind highlight colours, tooltip delay,
layout (Auto, Desktop, Phone), mouse and touch speed, invert zoom, graphics quality and shadows.

### Guide

- Pages written in plain words with pictures. One page per tool and per rule.
- Problems, tooltips and Settings link straight to the right page.
- Searchable.
- A first-time tutorial overlay is planned for later ([roadmap, Later](../roadmap.md#later)).

## Game theme

Each game's theme (colours, fonts, shapes, icons) comes from its `ui` package as design tokens. See
[UI principles and themes](../ui/README.md#game-theme).
