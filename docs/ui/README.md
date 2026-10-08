# UI principles and themes

> **In short:** Show, don't hide. Forgive mistakes. Explain, don't just block. Same feel in every
> game. Everything works by mouse, touch and keyboard. Each game brings its own theme; the
> controls stay the same.

## UX principles

| #   | Principle                     | What it means in Glade                                                             |
| --- | ----------------------------- | ---------------------------------------------------------------------------------- |
| 1   | **Direct**                    | Grab a thing and move it. No "edit mode" first.                                    |
| 2   | **Always visible state**      | The active tool, mode and selection type are always highlighted, even in the rail. |
| 3   | **Forgiving**                 | Everything can be undone. Bad drops snap back. `Esc` cancels.                      |
| 4   | **Explain, don't just block** | Every violation says what broke, where, and how to fix it, in plain words.         |
| 5   | **Everything has a name**     | Hover or focus any control and its name shows. On touch, a tap shows it.           |
| 6   | **Same feel in every game**   | Same places, same keys. Only the look and the game tools change.                   |
| 7   | **Progressive**               | Simple first. Extra options sit in menus and flyouts.                              |
| 8   | **Every input**               | Mouse, touch, pen and keyboard can do every task.                                  |
| 9   | **Fast feedback**             | Visual reply within 100 ms. Longer work shows progress.                            |
| 10  | **Never lose work**           | Autosave locally, always. Warn before anything is lost.                            |

## Game theme

Each game sets **design tokens** in its `ui` package (`@glade/<id>-ui`). Shared screens only use
tokens, never raw colours, so every game gets its own look with the same controls.

| Token group | Examples                                                 | Petit Planet                                                             |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Colours     | `--surface`, `--accent`, `--text`, `--hover`, `--select` | Soft pastels, green accent                                               |
| Fonts       | `--font-title`, `--font-ui`                              | A rounded open font for titles (Q-9). Atkinson Hyperlegible for UI text. |
| Shape       | `--radius`, `--border`                                   | Round corners, soft borders                                              |
| Icons       | Icon set id                                              | Rounded icon set, with the game's own tool icons (`ui/theme/icons/`)     |

Rules:

- Text contrast at least 4.5 : 1 (checked in tests).
- Focus ring is always visible and high contrast, in every theme.
- No game assets (fonts, images, sounds) taken from the game. Fonts are open fonts; icons and
  models are original work.

## Where UI code lives

| What                                                     | Package          |
| -------------------------------------------------------- | ---------------- |
| Tokens, controls (buttons, sliders, menus), shared icons | `@glade/ui`      |
| The planner's screens (side panel, rail, pills)          | `@glade/planner` |
| The builder's screens                                    | `@glade/builder` |
| One game's theme, icons and words                        | `@glade/<id>-ui` |

See also [accessibility](accessibility.md).
