import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("runtime Docker package", () => {
  it("deploys production dependencies with a hoisted node_modules layout", async () => {
    const dockerfile = await readFile(
      join(import.meta.dirname, "../../Dockerfile"),
      "utf8",
    );

    expect(dockerfile).toContain("pnpm config set node-linker hoisted");
    expect(dockerfile).toContain(
      "pnpm --filter @rntme/runtime --prod deploy /out",
    );
  });

  it("asserts the packaged image can resolve workspace packages during build", async () => {
    const dockerfile = await readFile(
      join(import.meta.dirname, "../../Dockerfile"),
      "utf8",
    );

    expect(dockerfile).toContain(
      "test -f /out/node_modules/@rntme/pdm/package.json",
    );
    expect(dockerfile).toContain("test ! -L /out/node_modules/@rntme/pdm");
    expect(dockerfile).toContain(
      "await import('/out/dist/load/load-service.js')",
    );
  });
});
