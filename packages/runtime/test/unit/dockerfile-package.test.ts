import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("runtime Docker package", () => {
  it("preserves the workspace package layout in the runtime image", async () => {
    const dockerfile = await readFile(
      join(import.meta.dirname, "../../Dockerfile"),
      "utf8",
    );

    expect(dockerfile).toContain("COPY --from=builder /build/node_modules ./node_modules");
    expect(dockerfile).toContain("COPY --from=builder /build/packages ./packages");
    expect(dockerfile).toContain(
      "COPY --from=builder /build/packages/runtime/assets/protos/identity-auth0.proto /srv/artifacts/identity-auth0.proto",
    );
    expect(dockerfile).toContain(
      'ENTRYPOINT ["node", "packages/runtime/dist/bin/runtime.js", "start"]',
    );
  });

  it("asserts the final image can resolve workspace packages during build", async () => {
    const dockerfile = await readFile(
      join(import.meta.dirname, "../../Dockerfile"),
      "utf8",
    );

    expect(dockerfile).toContain(
      "await import('/srv/packages/runtime/dist/load/load-service.js')",
    );
    expect(dockerfile).toContain("fs.access('/srv/artifacts/identity-auth0.proto')");
  });
});
