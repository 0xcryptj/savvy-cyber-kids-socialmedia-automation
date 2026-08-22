import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "@/src/workflow/state";
describe("workflow state machine", () => { it("allows the normal path", () => { expect(canTransition("DISCOVERED", "GENERATING")).toBe(true); expect(canTransition("PENDING_REVIEW", "APPROVED")).toBe(true); expect(canTransition("APPROVED", "QUEUED")).toBe(true); }); it("rejects unsafe transitions", () => { expect(canTransition("PUBLISHED", "APPROVED")).toBe(false); expect(() => assertTransition("PUBLISHED", "APPROVED")).toThrow(); }); });

describe("sending a post back for review", () => {
  it("lets an approved or queued post return to review", () => {
    expect(canTransition("APPROVED", "PENDING_REVIEW")).toBe(true);
    expect(canTransition("QUEUED", "PENDING_REVIEW")).toBe(true);
  });

  it("does not reopen a post whose schedule already exists in Postiz", () => {
    expect(canTransition("SCHEDULED", "PENDING_REVIEW")).toBe(false);
    expect(canTransition("PUBLISHED", "PENDING_REVIEW")).toBe(false);
  });
});
