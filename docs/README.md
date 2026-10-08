# Glade docs

Start with the [architecture overview](architecture.md): what Glade is, the idea that shapes it
(consistency in differences), its parts and where code lives. Then read the component you are
working on.

| Folder                                 | What it answers                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [profiles/](profiles/README.md)        | How is a game described? Maps, rules, kinds, the look, [item models](profiles/models.md), [adding a game](profiles/adding-a-game.md), [Petit Planet](profiles/petit-planet.md). |
| [edit/](edit/README.md)                | How do maps change? Ops, transactions, undo, the editor worker, shared ops and support styles.                                                                                  |
| [planner/](planner/README.md)          | What is on screen, how it behaves, and how it works inside.                                                                                                                     |
| [builder/](builder/README.md)          | How are custom items made?                                                                                                                                                      |
| [ui/](ui/README.md)                    | UX principles, game themes, [accessibility](ui/accessibility.md).                                                                                                               |
| [server/](server/README.md)            | The API, [saving and sharing](server/sharing.md), [file formats](server/formats.md).                                                                                            |
| [logging/](logging/README.md)          | Logs and bug reports, [error handling](logging/errors.md), [debugging](logging/debugging.md).                                                                                   |
| [engineering/](engineering/testing.md) | [Testing](engineering/testing.md), [CI and deploy](engineering/ci-and-deploy.md), [code style](engineering/code-style.md).                                                      |
| [roadmap.md](roadmap.md)               | What gets built in what order, risks, and open questions.                                                                                                                       |

## How to read these docs

- Most pages start with an **In short** box. Read only those first to get the whole picture fast.
- Pictures live in each folder's `diagrams/`. They are SVG images.
- Flow charts use **Mermaid**. GitHub shows them by itself. In VS Code, the extension "Markdown
  Preview Mermaid Support" shows them in the preview.
- Words in `code style` are names of files, functions or data fields.
- 🟢 means easy or ready. 🟡 means work needed. 🔴 means hard or risky.
- Open questions are numbered `Q-n` and listed in the [roadmap](roadmap.md#open-questions), each with
  a proposed answer.
