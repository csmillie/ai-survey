import { describe, it, expect } from "vitest";
import { formatUsd } from "@/lib/utils";

describe("formatUsd", () => {
  it("uses 2 decimals for amounts >= $1", () => {
    expect(formatUsd(1)).toBe("$1.00");
    expect(formatUsd(12.3456)).toBe("$12.35");
    expect(formatUsd(100)).toBe("$100.00");
  });

  it("uses 4 decimals for amounts >= $0.01", () => {
    expect(formatUsd(0.01)).toBe("$0.0100");
    expect(formatUsd(0.1234)).toBe("$0.1234");
    expect(formatUsd(0.9999)).toBe("$0.9999");
  });

  it("uses 6 decimals for amounts < $0.01", () => {
    expect(formatUsd(0.001234)).toBe("$0.001234");
    expect(formatUsd(0.000001)).toBe("$0.000001");
    expect(formatUsd(0)).toBe("$0.000000");
  });
});
