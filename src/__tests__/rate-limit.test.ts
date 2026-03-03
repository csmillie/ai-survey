import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing rate-limit module
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetFailedLogins,
} from "@/lib/rate-limit";

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockUpdate = vi.mocked(prisma.user.update);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkLoginRateLimit", () => {
  it("returns unlocked when user has no failed attempts", async () => {
    mockFindUnique.mockResolvedValue({
      failedLoginAttempts: 0,
      lockedUntil: null,
    } as never);

    const result = await checkLoginRateLimit("user-1");
    expect(result.locked).toBe(false);
  });

  it("returns locked when lockedUntil is in the future", async () => {
    const future = new Date(Date.now() + 600_000);
    mockFindUnique.mockResolvedValue({
      failedLoginAttempts: 5,
      lockedUntil: future,
    } as never);

    const result = await checkLoginRateLimit("user-1");
    expect(result.locked).toBe(true);
    expect(result.remainingMs).toBeGreaterThan(0);
  });

  it("returns unlocked when lock has expired", async () => {
    const past = new Date(Date.now() - 1000);
    mockFindUnique.mockResolvedValue({
      failedLoginAttempts: 5,
      lockedUntil: past,
    } as never);

    const result = await checkLoginRateLimit("user-1");
    expect(result.locked).toBe(false);
  });

  it("returns unlocked when user not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await checkLoginRateLimit("nonexistent");
    expect(result.locked).toBe(false);
  });
});

describe("recordFailedLogin", () => {
  it("increments failedLoginAttempts", async () => {
    mockFindUnique.mockResolvedValue({
      failedLoginAttempts: 2,
      lockedUntil: null,
    } as never);
    mockUpdate.mockResolvedValue({} as never);

    await recordFailedLogin("user-1");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { failedLoginAttempts: 3 },
    });
  });

  it("locks account after 5 failed attempts", async () => {
    mockFindUnique.mockResolvedValue({
      failedLoginAttempts: 4,
      lockedUntil: null,
    } as never);
    mockUpdate.mockResolvedValue({} as never);

    await recordFailedLogin("user-1");

    const call = mockUpdate.mock.calls[0]![0] as {
      data: { failedLoginAttempts: number; lockedUntil?: Date | null };
    };
    expect(call.data.failedLoginAttempts).toBe(5);
    expect(call.data.lockedUntil).toBeInstanceOf(Date);
    expect(call.data.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("resets counter when lock has expired before incrementing", async () => {
    const past = new Date(Date.now() - 1000);
    mockFindUnique.mockResolvedValue({
      failedLoginAttempts: 5,
      lockedUntil: past,
    } as never);
    mockUpdate.mockResolvedValue({} as never);

    await recordFailedLogin("user-1");

    const call = mockUpdate.mock.calls[0]![0] as {
      data: { failedLoginAttempts: number };
    };
    expect(call.data.failedLoginAttempts).toBe(1);
  });
});

describe("resetFailedLogins", () => {
  it("sets failedLoginAttempts to 0 and clears lockedUntil", async () => {
    mockUpdate.mockResolvedValue({} as never);

    await resetFailedLogins("user-1");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });
});
