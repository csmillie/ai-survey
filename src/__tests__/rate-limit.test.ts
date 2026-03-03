import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing rate-limit module
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
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
const mockUpdateMany = vi.mocked(prisma.user.updateMany);

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateMany.mockResolvedValue({ count: 0 } as never);
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
  it("atomically increments failedLoginAttempts", async () => {
    mockUpdate.mockResolvedValue({ failedLoginAttempts: 3 } as never);

    await recordFailedLogin("user-1");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
  });

  it("locks account when increment reaches threshold", async () => {
    mockUpdate
      .mockResolvedValueOnce({ failedLoginAttempts: 5 } as never)
      .mockResolvedValueOnce({} as never);

    await recordFailedLogin("user-1");

    // Second call should set lockedUntil
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    const lockCall = mockUpdate.mock.calls[1]![0] as {
      data: { lockedUntil: Date };
    };
    expect(lockCall.data.lockedUntil).toBeInstanceOf(Date);
    expect(lockCall.data.lockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it("does not lock when below threshold", async () => {
    mockUpdate.mockResolvedValue({ failedLoginAttempts: 3 } as never);

    await recordFailedLogin("user-1");

    // Only the increment call, no lock call
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("resets expired lock before incrementing", async () => {
    mockUpdate.mockResolvedValue({ failedLoginAttempts: 1 } as never);

    await recordFailedLogin("user-1");

    // updateMany should be called to clear expired locks
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "user-1",
        lockedUntil: { not: null, lte: expect.any(Date) },
      },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
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
