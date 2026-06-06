import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  target: "node22",
  clean: true,
  // Workspace source package must be bundled in; everything else stays external.
  noExternal: ["@lineup/shared"],
});
