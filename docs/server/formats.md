# File formats

> **In short:** Glade files are JSON. A map file wraps the profile's own map file and adds the packs it needs. A pack file holds items, each with its catalog entry and its builder recipe. Every file has a format version, so old files keep loading.

## Map file (`.glade-map.json`)

```json
{
  "glade": "map",
  "format": 1,
  "game": "petit-planet",
  "packs": [{ "id": "Kp3vX8…", "version": 2, "name": "Garden Set", "hash": "sha256-…" }],
  "view": { "mode": "furniture", "time": 12, "season": "spring", "view": "3d", "camera": "iso" },
  "map": {
    "version": 3,
    "game": "petit-planet",
    "map": "planet",
    "name": "main",
    "meta": {},
    "layers": {}
  }
}
```

| Field             | Meaning                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `glade`, `format` | File type and Glade format version                                                                                                                        |
| `game`            | The game's id                                                                                                                                             |
| `packs`           | Pack versions the map needs                                                                                                                               |
| `view`            | Optional: how it was last viewed                                                                                                                          |
| `map`             | The profile's own map file, unchanged (`serializeMap` output). Version 3: its `map` field says which map type it is (`planet`, `interior_home_1_8`, ...). |

A plain map file (the inner `map` on its own) can also be imported. Glade wraps it. Version 2 files (from before map types) load as the island. Old game ids keep working too (`petite-planet`).

## Pack file (`.glade-pack.json`)

```json
{
  "glade": "pack",
  "format": 1,
  "id": "Kp3vX8…",
  "version": 2,
  "game": "petit-planet",
  "name": "Garden Set",
  "description": "Benches, hedges and lamps",
  "kinds": [{ "kind": "pack:Kp3vX8:bench", "parent": "item", "description": "a bench" }],
  "items": [
    {
      "entry": {
        "type": "pack:Kp3vX8:lounge-chair",
        "kind": "item",
        "footprint": { "w": 2, "h": 4 },
        "shape": "lounge",
        "glyph": "c",
        "model": { "parts": [] }
      },
      "meta": { "name": "Lounge chair", "category": "seating", "tags": ["wood", "outdoor"] },
      "recipe": { "builder": 1, "template": "other", "footprint": [1, 2], "parts": [] }
    }
  ]
}
```

| Part     | Who reads it                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `kinds`  | The profile. Optional kinds the pack adds, each under a kind the game knows. Their entries follow all of the parent's rules. |
| `entry`  | The profile (rules and drawing). Must pass `entryProblems`, and the whole pack must pass `catalogProblems`.                  |
| `meta`   | Glade (drawer, search).                                                                                                      |
| `recipe` | The builder (editing). Optional: items made outside the builder have none, and open as plain shapes.                         |

## Clipboard fragment

```json
{
  "glade": "fragment",
  "format": 1,
  "game": "petit-planet",
  "map": "planet",
  "mode": "furniture",
  "origin": { "grid": "minor", "x": 0, "y": 0 },
  "size": { "w": 6, "h": 4 },
  "content": { "items": [], "plants": [], "onSurfaces": [], "paths": [], "terrain": null }
}
```

Positions inside are relative to `origin`, so it can be pasted anywhere. `map` names the map type. Pasting island content into a home (or the other way) keeps only what the target map type takes; a pill says what was left out. Things on tables travel with their table.

## Format versions

1. Every file has `format`.
2. `packages/formats/src/migrate/` holds one function per step: `v1 → v2`, `v2 → v3`, ...
3. On load, Glade runs the steps in order, then the profile's own `migrate` on the inner map.
4. Each step has a test with a real old file.
