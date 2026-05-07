import { createDb } from "./client.js";
import { resolveDatabaseUrl } from "./database-url.js";
import { projects, agents, goals, subprojects, issues } from "./schema/index.js";

const url = resolveDatabaseUrl();

const db = createDb(url);

console.log("Seeding database...");

const [project] = await db
  .insert(projects)
  .values({
    name: "Gitmesh Demo",
    description: "A demo autonomous project",
    status: "active",
    budgetMonthlyCents: 50000,
  })
  .returning();

const [triage] = await db
  .insert(agents)
  .values({
    projectId: project!.id,
    name: "Triage Bot",
    role: "triage",
    title: "Triage Agent",
    status: "idle",
    adapterType: "process",
    adapterConfig: { command: "echo", args: ["hello from triage"] },
    budgetMonthlyCents: 15000,
  })
  .returning();

const [prReviewer] = await db
  .insert(agents)
  .values({
    projectId: project!.id,
    name: "PR Review Bot",
    role: "pr_review",
    title: "PR Review Agent",
    status: "idle",
    reportsTo: triage!.id,
    adapterType: "process",
    adapterConfig: { command: "echo", args: ["hello from pr_review"] },
    budgetMonthlyCents: 10000,
  })
  .returning();

const [goal] = await db
  .insert(goals)
  .values({
    projectId: project!.id,
    title: "Ship V1",
    description: "Deliver first control plane release",
    level: "project",
    status: "active",
    ownerAgentId: triage!.id,
  })
  .returning();

const [subproject] = await db
  .insert(subprojects)
  .values({
    projectId: project!.id,
    goalId: goal!.id,
    name: "Control Plane MVP",
    description: "Implement core operator + agent loop",
    status: "in_progress",
    leadAgentId: triage!.id,
  })
  .returning();

await db.insert(issues).values([
  {
    projectId: project!.id,
    subprojectId: subproject!.id,
    goalId: goal!.id,
    title: "Implement atomic task checkout",
    description: "Ensure in_progress claiming is conflict-safe",
    status: "todo",
    priority: "high",
    assigneeAgentId: prReviewer!.id,
    createdByAgentId: triage!.id,
  },
  {
    projectId: project!.id,
    subprojectId: subproject!.id,
    goalId: goal!.id,
    title: "Add budget auto-pause",
    description: "Pause agent at hard budget ceiling",
    status: "backlog",
    priority: "medium",
    createdByAgentId: triage!.id,
  },
]);

console.log("Seed complete");
process.exit(0);
