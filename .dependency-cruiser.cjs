module.exports = {
  forbidden: [
    {
      name: 'modules-only-import-contracts',
      severity: 'error',
      comment:
        'Vendor modules are plug-ins by contract. Imports from packages/{runtime,artifacts,deploy,platform,tooling}/* are forbidden.',
      from: { path: '^modules/' },
      to: { path: '^packages/(?!contracts/)' },
    },
    {
      name: 'contracts-must-stay-leaves',
      severity: 'error',
      comment:
        'Contracts must not depend on implementations or vendor modules. A contract may depend only on other contracts.',
      from: { path: '^packages/contracts/' },
      to: { path: '^(packages/(?!contracts/)|modules/)' },
    },
    {
      name: 'tooling-only-imports-contracts',
      severity: 'error',
      comment:
        'Tooling/scaffolding ships examples for module authors; it must not pull runtime/artifacts/deploy/platform into their graph.',
      from: { path: '^packages/tooling/' },
      to: { path: '^packages/(runtime|artifacts|deploy|platform)/' },
    },
    {
      name: 'artifacts-must-not-import-runtime',
      severity: 'error',
      comment:
        'Artifacts (blueprint, qsm, pdm, …) describe what the runtime executes; any artifacts→runtime arrow is a bug.',
      from: { path: '^packages/artifacts/' },
      to: { path: '^packages/runtime/' },
    },
    {
      name: 'deploy-must-not-import-runtime',
      severity: 'error',
      comment:
        'Deploy plans/applies deployments. Anything needed from runtime must live in a contract.',
      from: { path: '^packages/deploy/' },
      to: { path: '^packages/runtime/' },
    },
    {
      name: 'deploy-runner-stages-must-stay-pure',
      severity: 'error',
      comment:
        'The pure stages layer (src/stages, run-deployment, build-deploy-config, redactor, smoke-verifier) must never open DB connections or import platform-storage. The handlers/ subdirectory is the platform-glue layer that may import these — see deploy-runner owner doc.',
      from: { path: '^packages/deploy/deploy-runner/src/(stages/|run-deployment|build-deploy-config|redactor|smoke-verifier|dokploy-client-factory|stage-runner|run-teardowns|deploy-target-types|types|index)' },
      to: { path: '^(packages/platform/platform-storage|node_modules/(pg|drizzle-orm))' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.base.json' },
    doNotFollow: { path: 'node_modules' },
    includeOnly: '^(packages|modules)/',
    exclude: { path: '(/test/|/dist/|/node_modules/|\\.test\\.ts$|\\.spec\\.ts$)' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node'],
    },
  },
};
