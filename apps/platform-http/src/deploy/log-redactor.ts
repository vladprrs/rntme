const SECRET_KEY =
  String.raw`(?:apiToken|api[-_]?key|x-api-key|clientSecret|client_secret|mgmtClientSecret|mgmt_client_secret|m2m_client_secret|m2mClientSecret|accessToken|access_token|refreshToken|refresh_token|password|token|secret|htpasswdB64|consolePassword|RNTME_CONSOLE_HTPASSWD_B64|htpasswd)`;

const REDACTION_PATTERNS: readonly {
  readonly pattern: RegExp;
  readonly replace: string;
}[] = [
  {
    pattern: /\b(Authorization\s*:\s*)(Bearer|Basic)\s+[^\s"',;&]+/gi,
    replace: '$1$2 ***',
  },
  {
    pattern: /\b(x-api-key\s*:\s*)[^\s"',;&]+/gi,
    replace: '$1***',
  },
  {
    pattern: new RegExp(String.raw`([?&]${SECRET_KEY}=)([^&#\s]+)`, 'gi'),
    replace: '$1***',
  },
  {
    pattern: new RegExp(String.raw`((?:"|')?${SECRET_KEY}(?:"|')?\s*[:=]\s*)(["']?)([^"',\s&}]+)\2`, 'gi'),
    replace: '$1$2***$2',
  },
  {
    pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g,
    replace: '$1 ***',
  },
];

const STRUCTURAL_REDACTION_PATTERNS: readonly { pattern: RegExp; replace: string }[] = [
  {
    pattern: /("(?:secretOutputs|targetSecrets|mgmtClientSecret|m2mClients)"\s*:\s*)([^,}\]]+)/g,
    replace: '$1"***"',
  },
  {
    pattern: /("(?:consolePassword|htpasswdB64)"\s*:\s*")([^"]*)(")/g,
    replace: '$1***$3',
  },
];

const ALL_PATTERNS = [...REDACTION_PATTERNS, ...STRUCTURAL_REDACTION_PATTERNS];

export function redact(input: string): string {
  let output = input;
  for (const { pattern, replace } of ALL_PATTERNS) {
    output = output.replace(pattern, replace);
  }
  return output;
}
