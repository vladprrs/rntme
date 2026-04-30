import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("runtime Docker package", () => {
  it("deploys production dependencies with a hoisted node_modules layout", async () => {
    const dockerfile = await readFile(
      join(import.meta.dirname, "../../Dockerfile"),
      "utf8",
    );

    expect(dockerfile).toContain(
      "pnpm --filter @rntme/runtime --prod --config.node-linker=hoisted deploy /out",
    );
  });
});
