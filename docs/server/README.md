# The server

> **In short:** A small Node.js server in the same Docker image as the web app. The site owner manages it with the `glade-admin` command on the server ([running the site](admin.md)), never through the web. It serves the app's files, signs people in ([accounts](accounts.md)), stores everyone's **drafts** and **shared snapshots** ([sharing](sharing.md)) in SQLite plus files on disk, checks every upload with the game profiles, and takes bug reports. It also relays calls from AI apps to your open Glade tab ([AI apps (MCP)](mcp.md)).

## API

Glade's API is under `/api/v1`. Better Auth's routes are under `/api/auth`. Bodies are JSON. Errors use the **Problem Details** standard (RFC 9457).

"Session" means the request carries the `glade.session_token` cookie. "Owner" means that session's user owns the thing.

**Sign-in (Better Auth)**

| Method | Path                                                          | Does                                                   |
| ------ | ------------------------------------------------------------- | ------------------------------------------------------ |
| `POST` | `/api/auth/sign-in/anonymous`                                 | Makes an anonymous user and a session (on first save). |
| `POST` | `/api/auth/sign-in/social`                                    | Starts logging in with Google (`provider: "google"`).  |
| `GET`  | `/api/auth/callback/google`                                   | Google sends the user back here.                       |
| `GET`  | `/api/auth/get-session`                                       | Who am I: user (anonymous or Google), session.         |
| `POST` | `/api/auth/sign-out`                                          | Ends this session.                                     |
| `GET`  | `/api/auth/list-sessions` · `POST` `/api/auth/revoke-session` | Devices list and "log out this device".                |

**Drafts** (the things you are working on)

| Method   | Path                | Needs                         | Does                                                                                                                                              |
| -------- | ------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/drafts`           | Session                       | My drafts (maps and packs): names, badges, thumbnails. No contents.                                                                               |
| `POST`   | `/drafts`           | Session                       | New draft (blank or a copy). Returns `id`, `revision: 1`.                                                                                         |
| `GET`    | `/drafts/:id`       | —                             | Owner: the draft's file and `revision`. Anyone else: `{ shareId }` if the draft is shared, otherwise `404` ([draft URLs](sharing.md#draft-urls)). |
| `PUT`    | `/drafts/:id`       | Owner, `If-Match: <revision>` | Overwrite. `409` if another device saved first; the app then reloads the latest ([two devices](accounts.md#two-devices-editing-the-same-map)).    |
| `DELETE` | `/drafts/:id`       | Owner                         | Delete the draft. `?stop_sharing=1` also stops its share.                                                                                         |
| `POST`   | `/drafts/:id/share` | Owner                         | Freeze the draft as a new snapshot. Makes the share on first use.                                                                                 |

**Shares** (frozen snapshots behind a link)

| Method   | Path                   | Needs   | Does                                                           |
| -------- | ---------------------- | ------- | -------------------------------------------------------------- |
| `GET`    | `/shares/:id`          | —       | The latest snapshot (or `?v=3`) and the pack versions it uses. |
| `GET`    | `/shares/:id/versions` | —       | List versions (number, date, size).                            |
| `POST`   | `/shares/:id/copy`     | Session | Make a copy: a new draft for me from a snapshot (`?v=3`).      |
| `DELETE` | `/shares/:id`          | Owner   | Stop sharing. Copies and pack versions in use stay.            |
| `POST`   | `/shares/:id/resume`   | Owner   | Share again, within 30 days of stopping.                       |

**Packs** use the same routes. A pack share's snapshots are the pack's versions, and `GET /shares/:id/v/:version` gets one version.

**Other**

| Method   | Path         | Needs                | Does                                                                                                          |
| -------- | ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/me/export` | Session              | Download my data: a zip of my drafts, shares, packs and account details ([your data](accounts.md#your-data)). |
| `DELETE` | `/me`        | Session              | Delete my account ([accounts](accounts.md#deleting-an-account)).                                              |
| `POST`   | `/reports`   | —                    | Send a bug report (+ log file, + optional map).                                                               |
| `POST`   | `/abuse`     | Session              | Report a shared map or pack: reason + note ([abuse reports](admin.md#abuse-reports)).                         |
| `GET`    | `/health`    | —                    | `200` when the database and disk work.                                                                        |
| `GET`    | `/metrics`   | Private network only | Prometheus metrics.                                                                                           |

**AI apps:** `/mcp`, the tab's live socket `/api/v1/live` and the OAuth routes are in [AI apps (MCP)](mcp.md#api).

**Error example**

```json
{
  "type": "https://glade.app/errors/GLD-API-409",
  "title": "This map changed on another device",
  "status": 409,
  "code": "GLD-API-409",
  "detail": "You started from revision 12. The latest is revision 13.",
  "latestRevision": 13
}
```

## Storage

> **In short:** Two kinds of data, stored two ways. **Drafts** change every few seconds, so each
> is one row, overwritten in place. **Snapshots** never change, so each is a file named by its
> hash and stored once, however many shares point at it.

| Table                                        | Columns (main ones)                                                                                                                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user`, `session`, `account`, `verification` | Better Auth's tables. `user.isAnonymous` comes from the anonymous plugin. Glade adds `user.banned_at`.                                                                                                           |
| `drafts`                                     | `id`, `owner_id`, `kind` (map / pack), `game`, `map_type`, `name`, `content` (gzipped file), `revision`, `pack_refs` (JSON), `copied_from` (share id + version), `share_id`, `thumb`, `created_at`, `updated_at` |
| `shares`                                     | `id`, `kind`, `owner_id` (null after the owner is deleted), `game`, `name`, `latest_version`, `status` (live / stopped / under review / hidden), `created_at`, `updated_at`, `stopped_at`                        |
| `snapshots`                                  | `share_id`, `version`, `blob_hash`, `size_bytes`, `thumb`, `pack_refs` (JSON, maps only), `created_at`                                                                                                           |
| `reports`                                    | `id`, `created_at`, `app_version`, `summary`, `log_blob_hash`, `map_blob_hash` (if given), `status`                                                                                                              |
| `abuse_reports`                              | `id`, `case_id`, `share_id`, `version`, `reporter_id`, `reason`, `note`, `created_at`                                                                                                                            |
| `abuse_cases`                                | `id` (`A-12`), `share_id`, `status` (open / under review / hidden / dismissed), `reports`, `dismissed_version`, `notified_at`, `created_at`, `closed_at`                                                         |
| `admin_log`                                  | `id`, `by` (shell user or `--by`), `action`, `target`, `reason`, `created_at`                                                                                                                                    |
| `rate_limits`                                | `bucket`, `window_start`, `count`                                                                                                                                                                                |
| `schema_migrations`                          | `version`, `applied_at`                                                                                                                                                                                          |

- **Drafts** live in their row, gzipped (a full island is about 150 KB, about 20 KB gzipped). A save overwrites `content` and adds 1 to `revision`. There is no history and no file to clean up.
- **Snapshots, logs and report maps** live on disk, named by their SHA-256 hash: `/data/blobs/ab/cd/abcd…`. The same file is only stored once. Example: Ben shares an unchanged copy of Ana's map. Two `snapshots` rows, one file.
- **Clean-up** (nightly): a file is deleted when no row points at it any more. A map snapshot's file stays for 30 days after **Stop sharing**, so **Share again** works. Drafts are never cleaned up this way. A pack version stays while any draft or snapshot lists it in `pack_refs`.
- SQLite runs in WAL mode. One file: `/data/glade.db`.
- Migrations are numbered SQL files. They only **add** things (new tables, new columns), so an older app version still works after a rollback ([CI and deploy](../engineering/ci-and-deploy.md#rollback-by-hand)). Better Auth's tables come from its own generated SQL, kept as Glade migrations.

## Upload checks (in order)

Every draft save, share, import and pack publish goes through these.

1. Size under the limit.
2. Valid JSON.
3. Matches the zod schema for a Glade map or pack.
4. The game exists, and **the map type exists** in it (the inner map's `map` field).
5. The profile loads it (`loadMap(parsed, game)`) without error. This also upgrades older map files.
6. Every pack passes `catalogProblems(map, catalog)` for each map type it is used on: kinds, repeated types, and each entry's own checks (`entryProblems`).
7. Every pack a map uses exists and is readable by the uploader: a published version, or the uploader's own draft pack. A **snapshot** may only use published versions.
8. Text fields (names, descriptions) are plain text, trimmed, under length limits.
9. **(homes)** Wallpaper and flooring patterns: colours and shapes only. A picture (`pattern.image`) is refused until Q-23 is decided. Profiles never store pictures, so the server would have to.

Violations of **game rules** do not block an upload. People may save and share maps that are still in progress.

## Limits

| Limit                                | Value                                |
| ------------------------------------ | ------------------------------------ |
| Map file                             | 2 MB (a full island is about 150 KB) |
| Pack file                            | 5 MB                                 |
| Items per pack                       | 500                                  |
| Drafts per user                      | 200                                  |
| Bug report (with log)                | 5 MB                                 |
| New anonymous users per IP per hour  | 10                                   |
| New drafts per user per hour         | 60                                   |
| Shares and updates per user per hour | 30                                   |
| Saves per draft per minute           | 30                                   |

Rate limits use the IP only in memory, for counting. It is never written to disk.

## Security

| Topic           | Rule                                                                                                                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in         | Better Auth: anonymous users and Google only. No passwords ([accounts](accounts.md)).                                                                                                                                                                                             |
| Cookies         | One: `glade.session_token`. `HttpOnly`, `Secure`, `SameSite=Lax`.                                                                                                                                                                                                                 |
| Forged requests | `SameSite=Lax`, plus every request that changes something must come from Glade's own origin (`Origin` header checked) and be JSON.                                                                                                                                                |
| Ownership       | Every draft and share route checks `owner_id` against the session's user. Not the owner → `404` for both "private" and "doesn't exist", so ids can't be probed. One exception: a draft URL of a **shared** draft answers with its share id ([draft URLs](sharing.md#draft-urls)). |
| IDs             | 21-character random ids (nanoid). Not guessable.                                                                                                                                                                                                                                  |
| Headers         | Strict Content-Security-Policy (no outside scripts; Google sign-in is a page redirect, not a script), `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, HSTS (by the reverse proxy).                                                                                      |
| CORS            | Same origin only.                                                                                                                                                                                                                                                                 |
| Input           | Every body checked by zod. Unknown fields rejected.                                                                                                                                                                                                                               |
| Content         | Names and descriptions shown as text only, never as HTML.                                                                                                                                                                                                                         |
| Secrets         | `BETTER_AUTH_SECRET` and the Google client secret come from the environment, never the repo ([setup](accounts.md#setup)).                                                                                                                                                         |
| Dependencies    | `pnpm audit` and licence check in CI.                                                                                                                                                                                                                                             |
| Container       | Runs as a non-root user. Read-only file system except `/data`.                                                                                                                                                                                                                    |
