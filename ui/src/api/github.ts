import { api } from "./client";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  html_url: string;
  default_branch: string;
  updated_at: string;
  description: string | null;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export const githubApi = {
  listRepos: () => api.get<GitHubRepo[]>("/github/repos"),
  getUser: () => api.get<GitHubUser>("/github/user"),
  connectProject: (data: { projectId: string; forgeOwner: string; forgeRepo: string }) =>
    api.post("/github/connect-project", data),
};
