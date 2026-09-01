import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "node22",
    splitting: false,
    treeshake: true,
  },
  {
    entry: {
      cli: "src/cli.ts",
    },
    format: ["esm"],
    banner: {
      js: "#!/usr/bin/env node",
    },
    clean: false,
    sourcemap: true,
    target: "node22",
    splitting: false,
    treeshake: true,
  },
]);
