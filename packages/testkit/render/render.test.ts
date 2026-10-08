// Render goldens: the demo island at each time of day, drawn by @glade/three in headless Chrome
// (page/, a bare MapScene with no UI) and compared with a tolerance (water and sky animate).
// Opt-in, since it starts a dev server and Chrome: GLADE_RENDER=1 pnpm test packages/testkit/render.
// UPDATE_GOLDENS=1 rewrites the images. Skipped when not asked for or when Chrome is missing;
// GLADE_CHROME points at another Chrome.

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decodePng, diffShare } from "./png";

const CHROME =
  process.env.GLADE_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const enabled = process.env.GLADE_RENDER === "1" && existsSync(CHROME);
const update = process.env.UPDATE_GOLDENS === "1";
const DATA = join(__dirname, "data");

/** Share of pixels allowed to differ noticeably (animated water, stars, float noise). */
const TOLERANCE = 0.01;

const VIEWS: Record<string, Record<string, unknown>> = {
  "iso-morning-spring": { camera: "iso", time: 7, season: "spring" },
  "walk-midday-spring": {
    rect: { grid: "major", x: 40, y: 40, w: 16, h: 16 },
    camera: "walk",
    time: 12,
    season: "spring",
  },
  "iso-afternoon-winter": { camera: "iso", time: 16.5, season: "winter" },
  "top-night-spring": { camera: "top", time: 21, season: "spring" },
};

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** POST /api/capture: the page's { name, png } (or { name, error }), written to `dir`. */
function captureRoute(dir: string): Plugin {
  return {
    name: "capture",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== "/api/capture" || req.method !== "POST") return next();
        const { name, png, error } = JSON.parse(await readBody(req)) as {
          name: string;
          png?: string;
          error?: string;
        };
        if (/^[\w.-]+$/.test(name)) {
          await (png
            ? writeFile(resolve(dir, `${name}.png`), Buffer.from(png, "base64"))
            : writeFile(resolve(dir, `${name}.error`), error ?? "no image", "utf8"));
        }
        res.statusCode = 204;
        res.end();
      });
    },
  };
}

async function stop(p: ChildProcess | undefined): Promise<void> {
  if (!p || p.exitCode !== null) return;
  const exited = new Promise((ok) => p.once("exit", ok));
  p.kill();
  await exited;
}

describe.runIf(enabled)("render goldens", () => {
  let dir: string;
  let server: ViteDevServer;
  let chrome: ChildProcess;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "glade-render-"));
    server = await createServer({
      configFile: false,
      root: join(__dirname, "page"),
      logLevel: "silent",
      server: { port: 0, host: "127.0.0.1" },
      plugins: [captureRoute(dir)],
    });
    await server.listen();
    const url = server.resolvedUrls!.local[0];
    const capture = Object.entries(VIEWS).map(([name, v]) => ({
      name,
      request: { ...v, size: 256 },
    }));
    chrome = spawn(
      CHROME,
      [
        "--headless=new",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${join(dir, "chrome")}`,
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--window-size=900,700",
        `${url}?capture=${encodeURIComponent(JSON.stringify(capture))}`,
      ],
      { stdio: "ignore" },
    );
    const done = (name: string) =>
      existsSync(join(dir, `${name}.png`)) || existsSync(join(dir, `${name}.error`));
    for (let i = 0; !Object.keys(VIEWS).every(done); i++) {
      if (i > 240) throw new Error("the headless page did not capture every view");
      await new Promise((ok) => setTimeout(ok, 500));
    }
  }, 150_000);

  afterAll(async () => {
    await stop(chrome);
    await server?.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  for (const name of Object.keys(VIEWS)) {
    it(name, async () => {
      const failed = join(dir, `${name}.error`);
      if (existsSync(failed))
        throw new Error(`could not render: ${await readFile(failed, "utf8")}`);
      const png = await readFile(join(dir, `${name}.png`));
      const file = join(DATA, `${name}.png`);
      if (update || !existsSync(file)) {
        await mkdir(DATA, { recursive: true });
        await writeFile(file, png);
        return;
      }
      const share = diffShare(decodePng(png), decodePng(await readFile(file)));
      if (share > TOLERANCE) await writeFile(join(DATA, `${name}.actual.png`), png);
      expect(share, `${name}: ${(share * 100).toFixed(2)}% of pixels differ`).toBeLessThan(
        TOLERANCE,
      );
    });
  }
});
