import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";

describe("runtime Docker package", () => {
  it("preserves the workspace package layout in the runtime image", async () => {
    const dockerfile = await readFile(
      join(import.meta.dirname, "../../Dockerfile"),
      "utf8",
    );

    expect(dockerfile).toContain("FROM oven/bun:1.3.13-alpine AS builder");
    expect(dockerfile).toContain("COPY --from=builder /build /srv");
    expect(dockerfile).toContain(
      'ENTRYPOINT ["bun", "packages/runtime/runtime/dist/bin/runtime.js", "start"]',
    );
  });

  it("asserts the final image can resolve workspace packages during build", async () => {
    const dockerfile = await readFile(
      join(import.meta.dirname, "../../Dockerfile"),
      "utf8",
    );

    expect(dockerfile).toContain(
      "await import('/srv/packages/runtime/runtime/dist/load/load-service.js')",
    );
    expect(dockerfile).toContain("fs.access('/srv/packages/runtime/runtime/assets/protos/identity-auth0.proto')");
  });
});
