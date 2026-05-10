import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { buildAdapterClient } from "../../src/start/build-adapter-client.js";
import type { ValidatedManifest } from "../../src/manifest/types.js";

describe("buildAdapterClient", () => {
  it("falls back to the bundled identity-auth0 proto when the artifact mount omits it", () => {
    const artifactDir = mkdtempSync(join(tmpdir(), "rntme-runtime-artifacts-"));
    const manifest = {
      modules: [
        {
          name: "identity-auth0",
          grpc: { address: "identity-auth0:50051" },
          protoPath: "identity-auth0.proto",
        },
      ],
    } as ValidatedManifest;

    expect(buildAdapterClient(manifest, artifactDir)).not.toBeNull();
  });
});
