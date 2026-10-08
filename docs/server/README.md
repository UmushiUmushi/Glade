# The server

> **In short:** A small Node.js server in the same Docker image as the web app. It serves the app's files, stores shared maps and packs in SQLite plus files on disk, checks every upload with the game profiles, and takes bug reports.

## API

All under `/api/v1`. Bodies are JSON. Errors use the **Problem Details** standard (RFC 9457).

| Method   | Path                                   | Needs                           | Does                                                     |
| -------- | -------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `POST`   | `/maps`                                | —                               | Create a shared map. Returns `id`, `editKey`, `version`. |
| `GET`    | `/maps/:id`                            | —                               | Get the latest version (or `?v=3`).                      |
| `GET`    | `/maps/:id/versions`                   | —                               | List versions (number, date, size).                      |
| `PUT`    | `/maps/:id`                            | Edit key, `If-Match: <version>` | Save a new version. `409` if not the latest.             |
| `DELETE` | `/maps/:id`                            | Edit key                        | Unpublish.                                               |
| `POST`   | `/packs`                               | —                               | Create a pack.                                           |
| `GET`    | `/packs/:id` · `/packs/:id/v/:version` | —                               | Get a pack version.                                      |
| `PUT`    | `/packs/:id`                           | Edit key                        | Publish a new version.                                   |
| `DELETE` | `/packs/:id`                           | Edit key                        | Unpublish (existing maps keep a cached copy).            |
| `POST`   | `/reports`                             | —                               | Send a bug report (+ log file, + optional map).          |
| `POST`   | `/abuse`                               | —                               | Report a shared map or pack.                             |
| `GET`    | `/health`                              | —                               | `200` when the database and disk work.                   |
| `GET`    | `/metrics`                             | Private network only            | Prometheus metrics.                                      |

**Error example**

```json
{
  "type": "https://glade.app/errors/GLD-API-409",
  "title": "This map has a newer version",
  "status": 409,
  "code": "GLD-API-409",
  "detail": "You started from version 3. The latest is version 4.",
  "latestVersion": 4
}
```

## Storage

| Table               | Columns (main ones)                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `things`            | `id`, `kind` (map / pack), `game`, `name`, `latest_version`, `edit_key_hash`, `created_at`, `updated_at`, `deleted_at`, `size_bytes` |
| `versions`          | `thing_id`, `version`, `blob_hash`, `created_at`, `pack_refs` (JSON, maps only)                                                      |
| `reports`           | `id`, `created_at`, `app_version`, `summary`, `log_blob_hash`, `map_blob_hash` (if given), `status`                                  |
| `rate_limits`       | `bucket`, `window_start`, `count`                                                                                                    |
| `schema_migrations` | `version`, `applied_at`                                                                                                              |

- File contents (maps, packs, logs) live on disk, named by their SHA-256 hash: `/data/blobs/ab/cd/abcd…`. The same file is only stored once.
- SQLite runs in WAL mode. One file: `/data/glade.db`.
- Migrations are numbered SQL files. They only **add** things (new tables, new columns), so an older app version still works after a rollback ([CI and deploy](../engineering/ci-and-deploy.md#rollback-by-hand)).

## Upload checks (in order)

1. Size under the limit.
2. Valid JSON.
3. Matches the zod schema for a Glade map or pack.
4. The game exists, and **the map type exists** in it (the inner map's `map` field).
5. The profile loads it (`loadMap(parsed, game)`) without error. This also upgrades older map files.
6. Every pack passes `catalogProblems(map, catalog)` for each map type it is used on: kinds, repeated types, and each entry's own checks (`entryProblems`).
7. Text fields (names, descriptions) are plain text, trimmed, under length limits.
8. **(homes)** Wallpaper and flooring patterns: colours and shapes only. A picture (`pattern.image`) is refused until Q-23 is decided. Profiles never store pictures, so the server would have to.

Violations of **game rules** do not block an upload. People may share maps that are still in progress.

## Limits

| Limit                    | Value                                |
| ------------------------ | ------------------------------------ |
| Map file                 | 2 MB (a full island is about 150 KB) |
| Pack file                | 5 MB                                 |
| Items per pack           | 500                                  |
| Bug report (with log)    | 5 MB                                 |
| Creates per IP per hour  | 60                                   |
| Saves per map per minute | [Testing](../engineering/testing.md) |

Rate limits use the IP only in memory, for counting. It is never written to disk.

## Security

| Topic        | Rule                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Keys         | 32 random bytes (base64url). Server stores only a SHA-256 hash.                                                                             |
| IDs          | 21-character random ids (nanoid). Not guessable.                                                                                            |
| Headers      | Strict Content-Security-Policy (no outside scripts), `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, HSTS (by the reverse proxy). |
| Cookies      | None.                                                                                                                                       |
| CORS         | Same origin only.                                                                                                                           |
| Input        | Every body checked by zod. Unknown fields rejected.                                                                                         |
| Content      | Names and descriptions shown as text only, never as HTML.                                                                                   |
| Dependencies | `pnpm audit` and licence check in CI.                                                                                                       |
| Container    | Runs as a non-root user. Read-only file system except `/data`.                                                                              |
