import { describe, it, expect } from "vitest";
import { MobilePageBackground } from "../MobilePageBackground";

describe("MobilePageBackground", () => {
  it("exports a component function", () => {
    expect(typeof MobilePageBackground).toBe("function");
  });

  it("has correct display name", () => {
    expect(MobilePageBackground.name).toBe("MobilePageBackground");
  });

  it("accepts optional className prop", () => {
    // Verify the function signature accepts className without throwing
    const props = { className: "extra-class" };
    expect(() => MobilePageBackground(props)).not.toThrow();
  });
});