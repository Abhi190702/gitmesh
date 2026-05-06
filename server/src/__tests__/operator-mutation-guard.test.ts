import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { operatorMutationGuard } from "../infra/middleware/operator-mutation-guard.js";

function createApp(actorType: "operator" | "agent", operatorSource: "session" | "local_implicit" = "session") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = actorType === "operator"
      ? { type: "operator", userId: "operator", source: operatorSource }
      : { type: "agent", agentId: "agent-1" };
    next();
  });
  app.use(operatorMutationGuard());
  app.post("/mutate", (_req, res) => {
    res.status(204).end();
  });
  app.get("/read", (_req, res) => {
    res.status(204).end();
  });
  return app;
}

describe("operatorMutationGuard", () => {
  it("allows safe methods for operator actor", async () => {
    const app = createApp("operator");
    const res = await request(app).get("/read");
    expect(res.status).toBe(204);
  });

  it("blocks board mutations without trusted origin", async () => {
    const app = createApp("operator");
    const res = await request(app).post("/mutate").send({ ok: true });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Operator mutation requires trusted browser origin" });
  });

  it("allows local implicit board mutations without origin", async () => {
    const app = createApp("operator", "local_implicit");
    const res = await request(app).post("/mutate").send({ ok: true });
    expect(res.status).toBe(204);
  });

  it("allows board mutations from trusted origin", async () => {
    const app = createApp("operator");
    const res = await request(app)
      .post("/mutate")
      .set("Origin", "http://localhost:3100")
      .send({ ok: true });
    expect(res.status).toBe(204);
  });

  it("allows board mutations from trusted referer origin", async () => {
    const app = createApp("operator");
    const res = await request(app)
      .post("/mutate")
      .set("Referer", "http://localhost:3100/issues/abc")
      .send({ ok: true });
    expect(res.status).toBe(204);
  });

  it("does not block authenticated agent mutations", async () => {
    const app = createApp("agent");
    const res = await request(app).post("/mutate").send({ ok: true });
    expect(res.status).toBe(204);
  });
});
