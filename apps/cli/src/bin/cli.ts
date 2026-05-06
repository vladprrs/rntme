import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { CLI_VERSION } from '../util/version.js';

import { runLogin } from '../commands/login.js';
import { runLogout } from '../commands/logout.js';
import { runWhoami } from '../commands/whoami.js';
import { runProjectCreate } from '../commands/project/create.js';
import { runProjectList } from '../commands/project/list.js';
import { runProjectShow } from '../commands/project/show.js';
import { runProjectPublish } from '../commands/project/publish.js';
import { runProjectVersionList } from '../commands/project/version-list.js';
import { runProjectVersionShow } from '../commands/project/version-show.js';
import { runProjectDeploy } from '../commands/project/deploy.js';
import { runProjectDeploymentList } from '../commands/project/deployment-list.js';
import { runProjectDeploymentShow } from '../commands/project/deployment-show.js';
import { runProjectDeploymentWatch } from '../commands/project/deployment-watch.js';
import { runProjectUpdateOperation } from '../commands/project/update-operation.js';
import { runProjectDeleteOperation } from '../commands/project/delete-operation.js';
import { runProjectOperationList } from '../commands/project/operation-list.js';
import { runProjectOperationShow } from '../commands/project/operation-show.js';
import { runProjectOperationWatch } from '../commands/project/operation-watch.js';
import { runTokenCreate } from '../commands/token/create.js';
import { runTokenList } from '../commands/token/list.js';
import { runTokenRevoke } from '../commands/token/revoke.js';
import { runInit } from '../commands/init.js';
import { runSkillsInstall } from '../commands/skills/install.js';
import { runTargetList } from '../commands/target/list.js';
import { runTargetShow } from '../commands/target/show.js';
import { runTargetSetConfig } from '../commands/target/set-config.js';
import { runTargetCreate } from '../commands/target/create.js';
import type { CommonFlags } from '../commands/harness.js';
import { registerHelp, lookupHelp } from '../help/registry.js';

registerHelp(['project', 'deploy'], `Usage: rntme project deploy --org <slug> --project <slug> --version <seq> --target <target-slug>
  [--runtime-image <ref>] [--config-overrides <path.json>] [--wait] [--timeout <sec>]

Starts a platform deployment of a previously published version against a deploy target.`);

registerHelp(['project', 'publish'], `Usage: rntme project publish [--org <slug>] [--project <slug>] [--dry-run] [folder]

Validates and uploads the project blueprint as a new version. Folder defaults to current directory.`);

registerHelp(['project', 'deployment', 'list'], `Usage: rntme project deployment list --org <slug> --project <slug> [--limit <n>]`);
registerHelp(['project', 'deployment', 'show'], `Usage: rntme project deployment show --org <slug> --project <slug> <deployment-id>`);
registerHelp(['project', 'deployment', 'watch'], `Usage: rntme project deployment watch --org <slug> --project <slug> <deployment-id>`);
registerHelp(['project', 'update'], `Usage: rntme project update --org <slug> --project <slug> --version <seq> --target <target-slug> [--wait] [--timeout <sec>]`);
registerHelp(['project', 'delete'], `Usage: rntme project delete --org <slug> --project <slug> --confirm <project-slug> [--wait] [--timeout <sec>]`);
registerHelp(['project', 'operation', 'list'], `Usage: rntme project operation list --org <slug> --project <slug> [--limit <n>]`);
registerHelp(['project', 'operation', 'show'], `Usage: rntme project operation show --org <slug> --project <slug> <operation-id>`);
registerHelp(['project', 'operation', 'watch'], `Usage: rntme project operation watch --org <slug> --project <slug> <operation-id>`);
registerHelp(['target', 'list'], `Usage: rntme target list [--org <slug>]`);
registerHelp(['target', 'show'], `Usage: rntme target show <slug> [--org <slug>]`);
registerHelp(['target', 'create'], `Usage: rntme target create <slug> --kind dokploy --display-name <name> --dokploy-url <url> --api-token <token> (--dokploy-project-id <id> | --dokploy-project-name <name> --allow-create-project) [--event-bus-mode provisioned] [--workflow-engine-image <ref>] [--workflow-worker-image <ref>] [--org <slug>]`);
registerHelp(['target', 'set-config'], `Usage: rntme target set-config <slug> --from <path> [--org <slug>]`);

const USAGE = `Usage: rntme [options] <command> [subcommand] [args...]

Commands:
  login                   Save credentials to local credentials file
  logout                  Remove local credentials
  whoami                  Print the authenticated user/org

  init <slug>             Scaffold a project blueprint in cwd
  skills install --agent  Install skill pack for the chosen agent

  project create <slug>   Create a new project
  project list            List projects in the org
  project show [slug]     Show a project
  project publish         Publish a project blueprint version
  project version list    List project versions
  project version show    Show a project version
  project deploy          Start a platform deployment
  project update          Queue a project update operation
  project delete          Queue a project decommission operation
  project operation list  List project operations
  project operation show  Show a project operation
  project operation watch Watch project operation logs until terminal status
  project deployment list List deployments
  project deployment show Show a deployment
  project deployment watch Watch deployment logs until terminal status

  token create <name>     Create a machine token
  token list              List tokens in the org
  token revoke <id>       Revoke a token

  target list             List deploy targets in the org
  target show <slug>      Show a deploy target
  target create <slug>    Create a new deploy target
  target set-config <slug> Update a deploy target from a JSON patch file

Global options:
  --json                  Output JSON instead of human-readable text
  --base-url <url>        API base URL (default: https://platform.rntme.com)
  --profile <name>        Credentials profile to use
  --org <slug>            Org slug
  --project <slug>        Project slug
  --token <pat>           Auth token (overrides credentials file)
  --verbose               Verbose output
  -q, --quiet             Suppress output on success
  --no-color              Disable colour output
  -h, --help              Show this help and exit
  -v, --version           Print the rntme CLI version and exit
`;

function readVersion(): string {
  return CLI_VERSION;
}

// ---------------------------------------------------------------------------
// Type-narrowing helpers — avoid `as` casts throughout the switch
// ---------------------------------------------------------------------------

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

function asStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
}

function setIfDefined<T, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): void {
  if (value !== undefined) obj[key] = value;
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

export async function main(argv: string[]): Promise<number> {
  if (argv.length === 1 && (argv[0] === '--version' || argv[0] === '-v')) {
    process.stdout.write(readVersion() + '\n');
    return 0;
  }
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        // global flags
        json: { type: 'boolean' },
        'base-url': { type: 'string' },
        profile: { type: 'string' },
        org: { type: 'string' },
        project: { type: 'string' },
        service: { type: 'string' },
        token: { type: 'string' },
        verbose: { type: 'boolean' },
        quiet: { type: 'boolean', short: 'q' },
        'no-color': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'string', short: 'v' },
        // command-specific flags
        tag: { type: 'string', multiple: true },
        message: { type: 'string' },
        'previous-version-seq': { type: 'string' },
        'include-archived': { type: 'boolean' },
        limit: { type: 'string' },
        cursor: { type: 'string' },
        'display-name': { type: 'string' },
        scopes: { type: 'string', multiple: true },
        preset: { type: 'string' },
        expires: { type: 'string' },
        from: { type: 'string' },
        kind: { type: 'string' },
        'dokploy-url': { type: 'string' },
        'dokploy-project-id': { type: 'string' },
        'dokploy-project-name': { type: 'string' },
        'allow-create-project': { type: 'boolean' },
        'api-token': { type: 'string' },
        'public-base-url': { type: 'string' },
        'event-bus-mode': { type: 'string' },
        'event-bus-image': { type: 'string' },
        'workflow-engine-image': { type: 'string' },
        'workflow-worker-image': { type: 'string' },
        'artifacts-dir': { type: 'string' },
        folder: { type: 'string' },
        'create-project': { type: 'boolean' },
        'dry-run': { type: 'boolean' },
        agent: { type: 'string' },
        target: { type: 'string' },
        force: { type: 'boolean' },
        'runtime-image': { type: 'string' },
        'config-overrides': { type: 'string' },
        wait: { type: 'boolean' },
        timeout: { type: 'string' },
        confirm: { type: 'string' },
      },
      allowPositionals: true,
      strict: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(message + '\n');
    process.stderr.write(USAGE);
    return 1;
  }

  const { values, positionals } = parsed;

  if (asBool(values['help']) === true) {
    const cmdPath: string[] = positionals;
    const sub = lookupHelp(cmdPath);
    if (sub !== null) {
      process.stdout.write(sub + '\n');
      return 0;
    }
    process.stdout.write(USAGE);
    return 0;
  }

  // Build commonFlags conditionally to satisfy exactOptionalPropertyTypes
  const commonFlags: CommonFlags = {};
  setIfDefined(commonFlags, 'json', asBool(values['json']));
  setIfDefined(commonFlags, 'baseUrl', asString(values['base-url']));
  setIfDefined(commonFlags, 'profile', asString(values['profile']));
  setIfDefined(commonFlags, 'org', asString(values['org']));
  setIfDefined(commonFlags, 'project', asString(values['project']));
  setIfDefined(commonFlags, 'service', asString(values['service']));
  setIfDefined(commonFlags, 'token', asString(values['token']));
  setIfDefined(commonFlags, 'verbose', asBool(values['verbose']));
  setIfDefined(commonFlags, 'quiet', asBool(values['quiet']));

  const cmd = positionals[0];

  if (!cmd) {
    process.stderr.write('No command given.\n\n');
    process.stderr.write(USAGE);
    return 1;
  }

  switch (cmd) {
    // -------------------------------------------------------------------------
    // login / logout / whoami
    // -------------------------------------------------------------------------
    case 'login': {
      const loginFlags: Parameters<typeof runLogin>[0] = {};
      setIfDefined(loginFlags, 'token', asString(values['token']));
      setIfDefined(loginFlags, 'baseUrl', asString(values['base-url']));
      setIfDefined(loginFlags, 'profile', asString(values['profile']));
      setIfDefined(loginFlags, 'org', asString(values['org']));
      setIfDefined(loginFlags, 'project', asString(values['project']));
      setIfDefined(loginFlags, 'json', asBool(values['json']));
      return runLogin(loginFlags);
    }

    case 'logout': {
      const logoutFlags: Parameters<typeof runLogout>[0] = {};
      setIfDefined(logoutFlags, 'json', asBool(values['json']));
      return runLogout(logoutFlags);
    }

    case 'whoami': {
      return runWhoami(commonFlags);
    }

    // -------------------------------------------------------------------------
    // project
    // -------------------------------------------------------------------------
    case 'project': {
      const sub = positionals[1];
      if (!sub) {
        process.stderr.write('Usage: rntme project <create|list|show|publish|version> ...\n');
        return 1;
      }
      switch (sub) {
        case 'create': {
          const slug = positionals[2];
          if (!slug) {
            process.stderr.write('Usage: rntme project create <slug> [--display-name <name>]\n');
            return 1;
          }
          const projectCreateArgs: Parameters<typeof runProjectCreate>[0] = { slug };
          setIfDefined(projectCreateArgs, 'displayName', asString(values['display-name']));
          return runProjectCreate(projectCreateArgs, commonFlags);
        }
        case 'list': {
          const projectListArgs: Parameters<typeof runProjectList>[0] = {};
          setIfDefined(projectListArgs, 'includeArchived', asBool(values['include-archived']));
          return runProjectList(projectListArgs, commonFlags);
        }
        case 'show': {
          const slug = positionals[2];
          const showArgs: Parameters<typeof runProjectShow>[0] = {};
          if (slug !== undefined) showArgs.slug = slug;
          return runProjectShow(showArgs, commonFlags);
        }
        case 'publish': {
          const positional = positionals[2];
          const flagFolder = asString(values['folder']);
          if (positional !== undefined && flagFolder !== undefined) {
            process.stderr.write('CLI_CONFIG_INVALID: cannot use positional and --folder together\n');
            return 1;
          }
          const folder = positional ?? flagFolder;
          const publishArgs: Parameters<typeof runProjectPublish>[0] = {};
          setIfDefined(publishArgs, 'folder', folder);
          setIfDefined(publishArgs, 'createProject', asBool(values['create-project']));
          setIfDefined(publishArgs, 'dryRun', asBool(values['dry-run']));
          return runProjectPublish(publishArgs, commonFlags);
        }
        case 'version': {
          const versionSub = positionals[2];
          if (!versionSub) {
            process.stderr.write('Usage: rntme project version <list|show> ...\n');
            return 1;
          }
          switch (versionSub) {
            case 'list': {
              const limitRaw = asString(values['limit']);
              const versionListArgs: Parameters<typeof runProjectVersionList>[0] = {};
              if (limitRaw !== undefined) {
                const n = Number.parseInt(limitRaw, 10);
                if (!Number.isNaN(n)) versionListArgs.limit = n;
              }
              setIfDefined(versionListArgs, 'cursor', asString(values['cursor']));
              return runProjectVersionList(versionListArgs, commonFlags);
            }
            case 'show': {
              const seqRaw = positionals[3];
              if (!seqRaw) {
                process.stderr.write('Usage: rntme project version show <seq>\n');
                return 1;
              }
              const seq = Number.parseInt(seqRaw, 10);
              if (Number.isNaN(seq) || seq <= 0) {
                process.stderr.write(`Invalid version seq: ${seqRaw}\n`);
                return 1;
              }
              return runProjectVersionShow({ seq }, commonFlags);
            }
            default: {
              process.stderr.write(`Unknown project version subcommand: ${versionSub}\n`);
              process.stderr.write('Usage: rntme project version <list|show> ...\n');
              return 2;
            }
          }
        }
        case 'deploy': {
          const versionRaw = asString(values['version']);
          const target = asString(values['target']);
          if (!versionRaw || !target) {
            process.stderr.write('Usage: rntme project deploy --version <seq> --target <target>\n');
            return 1;
          }
          const version = Number.parseInt(versionRaw, 10);
          if (Number.isNaN(version) || version <= 0) {
            process.stderr.write(`Invalid version seq: ${versionRaw}\n`);
            return 1;
          }
          const timeoutRaw = asString(values['timeout']);
          let timeoutSec: number | undefined;
          if (timeoutRaw !== undefined) {
            const n = Number.parseInt(timeoutRaw, 10);
            if (!Number.isNaN(n)) timeoutSec = n;
          }
          const deployArgs: Parameters<typeof runProjectDeploy>[0] = {
            version,
            target,
            runtimeImage: asString(values['runtime-image']),
            configOverridesPath: asString(values['config-overrides']),
            wait: asBool(values['wait']),
            timeoutSec,
          };
          return runProjectDeploy(deployArgs, commonFlags);
        }
        case 'update': {
          const versionRaw = asString(values['version']);
          const target = asString(values['target']);
          if (!versionRaw || !target) {
            process.stderr.write('Usage: rntme project update --version <seq> --target <target>\n');
            return 1;
          }
          const version = Number.parseInt(versionRaw, 10);
          if (Number.isNaN(version) || version <= 0) {
            process.stderr.write(`Invalid version seq: ${versionRaw}\n`);
            return 1;
          }
          return runProjectUpdateOperation(
            {
              version,
              target,
              wait: asBool(values['wait']),
              timeoutSec: parsePositiveInt(asString(values['timeout'])),
            },
            commonFlags,
          );
        }
        case 'delete': {
          const confirm = asString(values['confirm']);
          if (!confirm) {
            process.stderr.write('Usage: rntme project delete --confirm <project-slug>\n');
            return 1;
          }
          return runProjectDeleteOperation(
            {
              confirm,
              wait: asBool(values['wait']),
              timeoutSec: parsePositiveInt(asString(values['timeout'])),
            },
            commonFlags,
          );
        }
        case 'operation': {
          const operationSub = positionals[2];
          if (!operationSub) {
            process.stderr.write('Usage: rntme project operation <list|show|watch> ...\n');
            return 1;
          }
          switch (operationSub) {
            case 'list': {
              const operationListArgs: { limit?: number } = {};
              setIfDefined(operationListArgs, 'limit', parsePositiveInt(asString(values['limit'])));
              return runProjectOperationList(operationListArgs, commonFlags);
            }
            case 'show': {
              const operationId = positionals[3];
              if (!operationId) {
                process.stderr.write('Usage: rntme project operation show <operation-id>\n');
                return 1;
              }
              return runProjectOperationShow({ operationId }, commonFlags);
            }
            case 'watch': {
              const operationId = positionals[3];
              if (!operationId) {
                process.stderr.write('Usage: rntme project operation watch <operation-id>\n');
                return 1;
              }
              return runProjectOperationWatch(
                { operationId, timeoutSec: parsePositiveInt(asString(values['timeout'])) },
                commonFlags,
              );
            }
            default: {
              process.stderr.write(`Unknown project operation subcommand: ${operationSub}\n`);
              process.stderr.write('Usage: rntme project operation <list|show|watch> ...\n');
              return 2;
            }
          }
        }
        case 'deployment': {
          const deploymentSub = positionals[2];
          if (!deploymentSub) {
            process.stderr.write('Usage: rntme project deployment <list|show|watch> ...\n');
            return 1;
          }
          switch (deploymentSub) {
            case 'list': {
              const limitRaw = asString(values['limit']);
              const deploymentListArgs: { limit?: number } = {};
              if (limitRaw !== undefined) {
                const n = Number.parseInt(limitRaw, 10);
                if (!Number.isNaN(n)) deploymentListArgs.limit = n;
              }
              return runProjectDeploymentList(deploymentListArgs, commonFlags);
            }
            case 'show': {
              const deploymentId = positionals[3];
              if (!deploymentId) {
                process.stderr.write('Usage: rntme project deployment show <deployment-id>\n');
                return 1;
              }
              return runProjectDeploymentShow({ deploymentId }, commonFlags);
            }
            case 'watch': {
              const deploymentId = positionals[3];
              if (!deploymentId) {
                process.stderr.write('Usage: rntme project deployment watch <deployment-id>\n');
                return 1;
              }
              return runProjectDeploymentWatch({ deploymentId }, commonFlags);
            }
            default: {
              process.stderr.write(`Unknown project deployment subcommand: ${deploymentSub}\n`);
              process.stderr.write('Usage: rntme project deployment <list|show|watch> ...\n');
              return 2;
            }
          }
        }
        default: {
          process.stderr.write(`Unknown project subcommand: ${sub}\n`);
          process.stderr.write('Usage: rntme project <create|list|show|publish|version|deploy|update|delete|operation|deployment> ...\n');
          return 2;
        }
      }
    }

    // -------------------------------------------------------------------------
    // token
    // -------------------------------------------------------------------------
    case 'token': {
      const sub = positionals[1];
      if (!sub) {
        process.stderr.write('Usage: rntme token <create|list|revoke> ...\n');
        return 1;
      }
      switch (sub) {
        case 'create': {
          const name = positionals[2];
          if (!name) {
            process.stderr.write('Usage: rntme token create <name> [--scopes <s>...] [--expires <iso>]\n');
            return 1;
          }
          const scopes = asStringArray(values['scopes']) ?? [];
          const tokenCreateArgs: Parameters<typeof runTokenCreate>[0] = {
            name,
            scopes,
          };
          setIfDefined(tokenCreateArgs, 'expiresAt', asString(values['expires']));
          setIfDefined(tokenCreateArgs, 'preset', asString(values['preset']));
          return runTokenCreate(tokenCreateArgs, commonFlags);
        }
        case 'list': {
          return runTokenList(commonFlags);
        }
        case 'revoke': {
          const id = positionals[2];
          if (!id) {
            process.stderr.write('Usage: rntme token revoke <id>\n');
            return 1;
          }
          return runTokenRevoke({ id }, commonFlags);
        }
        default: {
          process.stderr.write(`Unknown token subcommand: ${sub}\n`);
          process.stderr.write('Usage: rntme token <create|list|revoke> ...\n');
          return 2;
        }
      }
    }

    // -------------------------------------------------------------------------
    // target
    // -------------------------------------------------------------------------
    case 'target': {
      const sub = positionals[1];
      if (!sub) {
        process.stderr.write('Usage: rntme target <list|show|create|set-config> ...\n');
        return 1;
      }
      switch (sub) {
        case 'list': {
          return runTargetList({}, commonFlags);
        }
        case 'show': {
          const slug = positionals[2];
          if (!slug) {
            process.stderr.write('Usage: rntme target show <slug> [--org <slug>]\n');
            return 1;
          }
          return runTargetShow({ slug }, commonFlags);
        }
        case 'create': {
          const slug = positionals[2];
          if (!slug) {
            process.stderr.write('Usage: rntme target create <slug> --kind dokploy --display-name <name> --dokploy-url <url> --api-token <token> ...\n');
            return 1;
          }
          return runTargetCreate({
            slug,
            kind: asString(values['kind']),
            displayName: asString(values['display-name']),
            dokployUrl: asString(values['dokploy-url']),
            dokployProjectId: asString(values['dokploy-project-id']),
            dokployProjectName: asString(values['dokploy-project-name']),
            allowCreateProject: asBool(values['allow-create-project']),
            apiToken: asString(values['api-token']),
            publicBaseUrl: asString(values['public-base-url']),
            eventBusMode: asString(values['event-bus-mode']),
            eventBusImage: asString(values['event-bus-image']),
            workflowEngineImage: asString(values['workflow-engine-image']),
            workflowWorkerImage: asString(values['workflow-worker-image']),
          }, commonFlags);
        }
        case 'set-config': {
          const slug = positionals[2];
          if (!slug) {
            process.stderr.write('Usage: rntme target set-config <slug> --from <path> [--org <slug>]\n');
            return 1;
          }
          const fromPath = asString(values['from']);
          if (!fromPath) {
            if (asBool(values['json']) === true) {
              process.stderr.write('`rntme target set-config --json <path>` was replaced by `--from <path>` because `--json` is the global output flag.\n');
            }
            process.stderr.write('Usage: rntme target set-config <slug> --from <path> [--org <slug>]\n');
            return 1;
          }
          return runTargetSetConfig({ slug, fromPath }, commonFlags);
        }
        default: {
          process.stderr.write(`Unknown target subcommand: ${sub}\n`);
          process.stderr.write('Usage: rntme target <list|show|create|set-config> ...\n');
          return 2;
        }
      }
    }

    // -------------------------------------------------------------------------
    // init + skills
    // -------------------------------------------------------------------------
    case 'init': {
      const slug = positionals[1];
      if (!slug) {
        process.stderr.write('Usage: rntme init <slug>\n');
        return 1;
      }
      const initArgs: Parameters<typeof runInit>[0] = { slug };
      setIfDefined(initArgs, 'json', asBool(values['json']));
      return runInit(initArgs);
    }

    case 'skills': {
      const sub = positionals[1];
      if (!sub) {
        process.stderr.write('Usage: rntme skills <install> ...\n');
        return 1;
      }
      switch (sub) {
        case 'install': {
          const agent = asString(values['agent']);
          if (!agent) {
            process.stderr.write('Usage: rntme skills install --agent <claude-code|cursor> [--target <p>] [--force]\n');
            return 1;
          }
          const installArgs: Parameters<typeof runSkillsInstall>[0] = { agent };
          setIfDefined(installArgs, 'target', asString(values['target']));
          setIfDefined(installArgs, 'force', asBool(values['force']));
          setIfDefined(installArgs, 'json', asBool(values['json']));
          return runSkillsInstall(installArgs);
        }
        default: {
          process.stderr.write(`Unknown skills subcommand: ${sub}\n`);
          return 2;
        }
      }
    }

    // -------------------------------------------------------------------------
    // Unknown top-level command
    // -------------------------------------------------------------------------
    default: {
      process.stderr.write(`Unknown command: ${cmd}\n\n`);
      process.stderr.write(USAGE);
      return 1;
    }
  }
}

// Only run when executed directly as the CLI entry point.
// In ESM, import.meta.url gives this file's URL; process.argv[1] is the entry file path.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main(process.argv.slice(2)));
}
