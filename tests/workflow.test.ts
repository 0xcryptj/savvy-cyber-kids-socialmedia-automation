import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "@/src/workflow/state";
describe("workflow state machine", () => { it("allows the normal path", () => { expect(canTransition("DISCOVERED", "GENERATING")).toBe(true); expect(canTransition("PENDING_REVIEW", "APPROVED")).toBe(true); expect(canTransition("APPROVED", "QUEUED")).toBe(true); }); it("rejects unsafe transitions", () => { expect(canTransition("PUBLISHED", "APPROVED")).toBe(false); expect(() => assertTransition("PUBLISHED", "APPROVED")).toThrow(); }); });
