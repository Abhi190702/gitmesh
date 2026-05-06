import { beforeEach, describe, expect, it } from "vitest";
import { deriveIssueUserContext } from "../core/issues.js";
import {
  makeIssue,
  makeIssueUserContextInput,
  resetFactoryCounters,
} from "./_helpers/factories.js";

beforeEach(() => {
  resetFactoryCounters();
});

/** Cases driven from a small table: each row = (name, issue, ctx, expected). */
interface Case {
  name: string;
  issue: ReturnType<typeof makeIssue>;
  userId: string;
  ctx: ReturnType<typeof makeIssueUserContextInput>;
  expectedTouchAt: string | null;
  expectedExternalAt: string | null;
  expectedUnread: boolean;
}

describe("deriveIssueUserContext", () => {
  const cases: Case[] = [
    {
      name: "marks issue unread when external comments are newer than my latest comment",
      issue: makeIssue({ createdByUserId: "user-1" }),
      userId: "user-1",
      ctx: makeIssueUserContextInput({
        myLastCommentAt: new Date("2026-03-06T12:00:00.000Z"),
        lastExternalCommentAt: new Date("2026-03-06T13:00:00.000Z"),
      }),
      expectedTouchAt: "2026-03-06T12:00:00.000Z",
      expectedExternalAt: "2026-03-06T13:00:00.000Z",
      expectedUnread: true,
    },
    {
      name: "marks issue read when my latest comment is newest",
      issue: makeIssue({ createdByUserId: "user-1" }),
      userId: "user-1",
      ctx: makeIssueUserContextInput({
        myLastCommentAt: new Date("2026-03-06T14:00:00.000Z"),
        lastExternalCommentAt: new Date("2026-03-06T13:00:00.000Z"),
      }),
      expectedTouchAt: "2026-03-06T14:00:00.000Z",
      expectedExternalAt: "2026-03-06T13:00:00.000Z",
      expectedUnread: false,
    },
    {
      name: "uses issue creation time as fallback touch point for creator",
      issue: makeIssue({
        createdByUserId: "user-1",
        createdAt: new Date("2026-03-06T09:00:00.000Z"),
      }),
      userId: "user-1",
      ctx: makeIssueUserContextInput({
        lastExternalCommentAt: new Date("2026-03-06T10:00:00.000Z"),
      }),
      expectedTouchAt: "2026-03-06T09:00:00.000Z",
      expectedExternalAt: "2026-03-06T10:00:00.000Z",
      expectedUnread: true,
    },
    {
      name: "uses issue updated time as fallback touch point for assignee",
      issue: makeIssue({
        assigneeUserId: "user-1",
        updatedAt: new Date("2026-03-06T15:00:00.000Z"),
      }),
      userId: "user-1",
      ctx: makeIssueUserContextInput({
        lastExternalCommentAt: new Date("2026-03-06T14:59:00.000Z"),
      }),
      expectedTouchAt: "2026-03-06T15:00:00.000Z",
      expectedExternalAt: "2026-03-06T14:59:00.000Z",
      expectedUnread: false,
    },
    {
      name: "uses latest read timestamp to clear unread without requiring a comment",
      issue: makeIssue({
        createdByUserId: "user-1",
        createdAt: new Date("2026-03-06T09:00:00.000Z"),
      }),
      userId: "user-1",
      ctx: makeIssueUserContextInput({
        myLastReadAt: new Date("2026-03-06T11:30:00.000Z"),
        lastExternalCommentAt: new Date("2026-03-06T11:00:00.000Z"),
      }),
      expectedTouchAt: "2026-03-06T11:30:00.000Z",
      expectedExternalAt: "2026-03-06T11:00:00.000Z",
      expectedUnread: false,
    },
    {
      name: "handles SQL timestamp strings without throwing",
      issue: makeIssue({
        createdByUserId: "user-1",
        createdAt: new Date("2026-03-06T09:00:00.000Z"),
      }),
      userId: "user-1",
      ctx: makeIssueUserContextInput({
        myLastCommentAt: "2026-03-06T10:00:00.000Z",
        lastExternalCommentAt: "2026-03-06T11:00:00.000Z",
      }),
      expectedTouchAt: "2026-03-06T10:00:00.000Z",
      expectedExternalAt: "2026-03-06T11:00:00.000Z",
      expectedUnread: true,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const result = deriveIssueUserContext(c.issue, c.userId, c.ctx);
      expect(result.myLastTouchAt?.toISOString() ?? null).toBe(c.expectedTouchAt);
      expect(result.lastExternalCommentAt?.toISOString() ?? null).toBe(c.expectedExternalAt);
      expect(result.isUnreadForMe).toBe(c.expectedUnread);
    });
  }
});
