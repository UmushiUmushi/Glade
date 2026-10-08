# Accessibility

> **In short:** Target **WCAG 2.2 level AA**. Everything works with keyboard, touch and screen readers. Nothing depends on colour alone. Timers can be paused. Text is plain and short.

| Need                     | How Glade meets it                                                                                                                                                                 | WCAG                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Keyboard for everything  | Every control reachable. Toolbars use arrow keys. Keyboard cursor for the map. `F6` between regions.                                                                               | 2.1.1                  |
| No keyboard traps        | `Esc` always backs out. Builder window: `F6` leaves it.                                                                                                                            | 2.1.2                  |
| Visible focus            | Thick, high-contrast focus ring in every theme.                                                                                                                                    | 2.4.7, 2.4.11          |
| Names on everything      | Tooltips on hover **and** focus. Tap shows names on touch. Every icon button has an accessible name.                                                                               | 1.1.1, 4.1.2           |
| Not colour alone         | Selection dashed, invalid striped + ⚠, layers show eye open/closed. Colour-blind palettes.                                                                                         | 1.4.1                  |
| Contrast                 | Text 4.5 : 1, controls 3 : 1. Tested per theme.                                                                                                                                    | 1.4.3, 1.4.11          |
| Dragging has another way | Click-to-place, keyboard move (`Space` + arrows), menu actions.                                                                                                                    | 2.5.7                  |
| Target size              | Buttons at least 32 px on desktop, 44 px on touch.                                                                                                                                 | 2.5.8                  |
| Timing                   | Pill timers pause on hover/focus, length in Settings, or "until closed".                                                                                                           | 2.2.1                  |
| Motion                   | "Reduce motion" turns off flashes, slides and camera easing. Follows the system setting.                                                                                           | 2.3.3                  |
| Screen readers           | Live region describes hover, selection, results and violations. Each game's `ui` package has its own `describe` text per map. The profile's `map.ui.hover` gives the cell readout. | 4.1.3                  |
| Text size                | Up to 200% without losing anything.                                                                                                                                                | 1.4.4                  |
| Reading                  | Plain words, short sentences. Dyslexia-friendly font option.                                                                                                                       | 3.1.5 (AAA, aimed for) |
| Help                     | Guide page links from pills, tooltips and Settings.                                                                                                                                | 3.3.5                  |

**What screen readers hear (examples)**

| Moment                     | Spoken                                                          |
| -------------------------- | --------------------------------------------------------------- |
| Hover with keyboard cursor | "Tile 34, 40. Grass, level 1. Chair."                           |
| Make a selection           | "Selected 3 chairs and 1 table in area C 4."                    |
| Drop is invalid            | "Can't place here. Items overlap. Press Escape to put it back." |
| Commit                     | "Moved 3 chairs."                                               |
| Undo                       | "Undid: move 3 chairs."                                         |

**How we test:** axe checks in Storybook and Playwright on every PR, keyboard-only end-to-end tests, and a manual VoiceOver + NVDA pass before each release ([testing](../engineering/testing.md)).
