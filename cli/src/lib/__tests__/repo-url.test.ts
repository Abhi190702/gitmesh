import { describe, expect, it } from "vitest";
import { parseRepoUrl } from "../repo-url.js";

describe("parseRepoUrl", () => {
  it("parses https github URLs", () => {
    const result = parseRepoUrl("https://github.com/LF-Decentralized-Trust-labs/gitmesh");
    expect(result).toMatchObject({
      provider: "github",
      owner: "LF-Decentralized-Trust-labs",
      repo: "gitmesh",
      host: "github.com",
    });
  });

  it("strips trailing .git", () => {
    const result = parseRepoUrl("https://github.com/octo/cat.git");
    expect(result.repo).toBe("cat");
  });

  it("parses ssh URLs", () => {
    const result = parseRepoUrl("git@github.com:octo/cat.git");
    expect(result).toMatchObject({ provider: "github", owner: "octo", repo: "cat" });
  });

  it("parses gitlab.com hosts", () => {
    const result = parseRepoUrl("https://gitlab.com/group/project");
    expect(result.provider).toBe("gitlab");
  });

  it("infers github from short owner/repo form", () => {
    const result = parseRepoUrl("octo/cat");
    expect(result).toMatchObject({ provider: "github", owner: "octo", repo: "cat" });
  });

  it("throws for empty input", () => {
    expect(() => parseRepoUrl("")).toThrow();
  });

  it("throws for unsupported hosts", () => {
    expect(() => parseRepoUrl("https://example.com/foo/bar")).toThrow(/Unsupported forge host/);
  });

  it("throws when owner/repo is missing", () => {
    expect(() => parseRepoUrl("https://github.com/")).toThrow();
  });
});
