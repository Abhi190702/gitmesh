import pc from "picocolors";

const TITLE = "GitMesh Agents CLI";
const TAGLINE = "Policy-as-code orchestration for OSS AI agents";

export function printGitmeshCliBanner(): void {
  const lines = [
    "",
    pc.bold(pc.cyan(`  ${TITLE}`)),
    pc.blue("  ───────────────────────────────────────────────────────"),
    pc.bold(pc.white(`  ${TAGLINE}`)),
    "",
  ];

  console.log(lines.join("\n"));
}
