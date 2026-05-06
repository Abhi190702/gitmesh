export type ForgeProvider = "github" | "gitlab" | "forgejo";

export interface ParsedRepoUrl {
  provider: ForgeProvider;
  owner: string;
  repo: string;
  host: string;
  cloneUrl: string;
}

const HOSTED_PROVIDERS: Record<string, ForgeProvider> = {
  "github.com": "github",
  "www.github.com": "github",
  "gitlab.com": "gitlab",
  "www.gitlab.com": "gitlab",
};

const SSH_PATTERN = /^(?:ssh:\/\/)?git@([^:/]+)[:/](.+?)(?:\.git)?\/?$/;
const HTTPS_PATTERN = /^https?:\/\/([^/]+)\/(.+?)(?:\.git)?\/?$/;
const SHORT_PATTERN = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/;

export function parseRepoUrl(input: string): ParsedRepoUrl {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Repository URL is empty.");
  }

  const sshMatch = SSH_PATTERN.exec(trimmed);
  if (sshMatch) {
    return resolve(sshMatch[1], sshMatch[2], trimmed);
  }

  const httpsMatch = HTTPS_PATTERN.exec(trimmed);
  if (httpsMatch) {
    return resolve(httpsMatch[1], httpsMatch[2], trimmed);
  }

  const shortMatch = SHORT_PATTERN.exec(trimmed);
  if (shortMatch) {
    return resolve("github.com", `${shortMatch[1]}/${shortMatch[2]}`, `https://github.com/${shortMatch[1]}/${shortMatch[2]}`);
  }

  throw new Error(
    `Could not parse repository URL "${input}". Supported forms: https://github.com/<owner>/<repo>, git@github.com:<owner>/<repo>.git, <owner>/<repo>.`,
  );
}

function resolve(rawHost: string, rawPath: string, source: string): ParsedRepoUrl {
  const host = rawHost.toLowerCase();
  const provider = HOSTED_PROVIDERS[host] ?? inferProviderFromHost(host);
  const segments = rawPath.replace(/^\/+/, "").split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error(`Repository URL "${source}" is missing owner/repo segments.`);
  }

  const owner = segments[0];
  const repo = segments[segments.length - 1].replace(/\.git$/i, "");
  if (!owner || !repo) {
    throw new Error(`Repository URL "${source}" has empty owner or repo name.`);
  }

  return {
    provider,
    owner,
    repo,
    host,
    cloneUrl: provider === "github" || provider === "gitlab"
      ? `https://${host}/${owner}/${repo}.git`
      : source,
  };
}

function inferProviderFromHost(host: string): ForgeProvider {
  if (host.includes("github")) return "github";
  if (host.includes("gitlab")) return "gitlab";
  if (host.includes("forgejo") || host.includes("codeberg")) return "forgejo";
  throw new Error(
    `Unsupported forge host "${host}". GitMesh currently supports github, gitlab, and forgejo.`,
  );
}
