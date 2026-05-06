/**
 * GitHub Client Factory
 *
 * Provides Octokit GitHub API client instances, with token management
 * from the project_secret_versions table.
 */

import { Octokit } from "@octokit/rest";
import { and, eq } from "drizzle-orm";
import type { Db } from "@gitmesh/data";
import { projectSecrets, projectSecretVersions } from "@gitmesh/data";

/**
 * Cache for GitHub clients to avoid re-instantiating for every call.
 * Key: `projectId:forgeProvider`, Value: Octokit instance
 */
const clientCache = new Map<string, Octokit>();

/**
 * Get or create a GitHub Octokit client for a project.
 * Loads the GitHub token from project_secret_versions table.
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @param forceProvider - Forge provider type (defaults to 'github')
 * @returns Octokit client instance, or null if no token found
 */
export async function getGitHubClient(
  db: Db,
  projectId: string,
  forceProvider: string = "github",
): Promise<Octokit | null> {
  const cacheKey = `${projectId}:${forceProvider}`;

  // Return cached client if available
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  // Look up GitHub token secret metadata
  const secretRows = await db
    .select()
    .from(projectSecrets)
    .where(eq(projectSecrets.projectId, projectId));

  // Find the GitHub token secret
  const tokenSecret = secretRows.find(
    (s) => s.name === "github_token" || s.name === "GITHUB_TOKEN",
  );

  if (!tokenSecret) {
    // Local-dev fallback: if no per-project secret has been provisioned but a
    // GITHUB_LOCAL_DEV_PAT is set in the environment, use it. This lets a
    // developer running `pnpm dev` in local_trusted mode operate against
    // GitHub without registering an OAuth App.
    const pat = process.env.GITHUB_LOCAL_DEV_PAT?.trim();
    const mode = process.env.GITMESH_DEPLOYMENT_MODE?.trim() ?? "local_trusted";
    if (pat && mode === "local_trusted") {
      const localDevClient = new Octokit({ auth: pat });
      clientCache.set(cacheKey, localDevClient);
      return localDevClient;
    }
    console.warn(`No GitHub token secret found for project ${projectId}`);
    return null;
  }

  // Get the latest version of the secret
  const secretVersionRows = await db
    .select()
    .from(projectSecretVersions)
    .where(
      and(
        eq(projectSecretVersions.secretId, tokenSecret.id),
        eq(projectSecretVersions.version, tokenSecret.latestVersion),
      ),
    );

  if (secretVersionRows.length === 0 || !secretVersionRows[0].material) {
    const fallbackRows = await db
      .select()
      .from(projectSecretVersions)
      .where(eq(projectSecretVersions.secretId, tokenSecret.id));
    if (fallbackRows.length === 0 || !fallbackRows[0].material) {
      console.warn(`No secret material found for GitHub token in project ${projectId}`);
      return null;
    }

    const fallbackMaterial = fallbackRows[0].material as Record<string, unknown>;
    const fallbackToken =
      (fallbackMaterial.token as string) ||
      (fallbackMaterial.github_token as string) ||
      (fallbackMaterial.GITHUB_TOKEN as string) ||
      Object.values(fallbackMaterial)[0];

    if (!fallbackToken || typeof fallbackToken !== "string") {
      console.warn(`Invalid GitHub token material for project ${projectId}`);
      return null;
    }

    const fallbackClient = new Octokit({ auth: fallbackToken });
    clientCache.set(cacheKey, fallbackClient);
    return fallbackClient;
  }

  if (!secretVersionRows[0].material) {
    console.warn(`No secret material found for GitHub token in project ${projectId}`);
    return null;
  }

  // Extract the token from the material
  // The material is typically { token: "..." } or { "github_token": "..." }
  const material = secretVersionRows[0].material as Record<string, unknown>;
  const token =
    (material.token as string) ||
    (material.github_token as string) ||
    (material.GITHUB_TOKEN as string) ||
    Object.values(material)[0];

  if (!token || typeof token !== "string") {
    console.warn(`Invalid GitHub token material for project ${projectId}`);
    return null;
  }

  // Create and cache the client
  const client = new Octokit({
    auth: token,
  });

  clientCache.set(cacheKey, client);
  return client;
}

/**
 * Invalidate cached client (e.g., after token rotation)
 */
export function invalidateGitHubClientCache(projectId: string): void {
  clientCache.delete(`${projectId}:github`);
}

/**
 * Post a comment on a GitHub issue or PR.
 */
export async function postGitHubComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<{ commentId: number } | null> {
  try {
    const response = await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
    return { commentId: response.data.id };
  } catch (error) {
    console.error(
      `Failed to post comment on ${owner}/${repo}#${issueNumber}:`,
      error,
    );
    return null;
  }
}

/**
 * Add labels to a GitHub issue or PR.
 */
export async function addGitHubLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[],
): Promise<boolean> {
  if (labels.length === 0) return true;

  try {
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
    return true;
  } catch (error) {
    console.error(
      `Failed to add labels to ${owner}/${repo}#${issueNumber}:`,
      error,
    );
    return false;
  }
}

/**
 * Request reviewers on a GitHub PR.
 */
export async function requestGitHubReviewers(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  reviewers: string[],
): Promise<boolean> {
  if (reviewers.length === 0) return true;

  try {
    await octokit.pulls.requestReviewers({
      owner,
      repo,
      pull_number: prNumber,
      reviewers,
    });
    return true;
  } catch (error) {
    console.error(
      `Failed to request reviewers on ${owner}/${repo}#${prNumber}:`,
      error,
    );
    return false;
  }
}

/**
 * Update GitHub issue or PR state (open/closed).
 */
export async function updateGitHubState(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  state: "open" | "closed",
): Promise<boolean> {
  try {
    await octokit.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      state,
    });
    return true;
  } catch (error) {
    console.error(
      `Failed to update state of ${owner}/${repo}#${issueNumber}:`,
      error,
    );
    return false;
  }
}
