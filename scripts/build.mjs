// Bundles tokenwarden into a single dist/cli.js for fast cold-start.
// One bundled file means no runtime dependency resolution on the PreToolUse
// hot path — the largest controllable slice of hook latency.
import { build } from "esbuild";
import { chmod } from "node:fs/promises";

const outfile = "dist/cli.js";

await build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile,
  minify: false,
  sourcemap: false,
  // Node built-ins only; tokenwarden ships zero runtime dependencies.
  external: [],
  banner: {
    js: "#!/usr/bin/env node\n// tokenwarden — bundled; edit src/ and rebuild with `npm run build`.",
  },
});

// Mark executable so the `tokenwarden` bin works on POSIX after a global install.
try {
  await chmod(outfile, 0o755);
} catch {
  // Windows / restricted FS: chmod is a no-op or unsupported; ignore.
}

console.log(`built ${outfile}`);
