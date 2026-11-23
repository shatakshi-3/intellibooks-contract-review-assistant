import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, requireContractOwnership, requireRole } from "@/lib/auth/protect";
import { isAdmin, ROLES } from "@/lib/auth/roles";
import { AppError } from "@/lib/errors";

// Mock @clerk/nextjs/server
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

// Mock @/lib/db
vi.mock("@/lib/db", () => {
  return {
    db: {
      select: vi.fn(),
    },
  };
});

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

describe("Authentication & Authorization Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isAdmin", () => {
    it("returns true for admin role", () => {
      expect(isAdmin(ROLES.ADMIN)).toBe(true);
    });

    it("returns false for regular user role or invalid values", () => {
      expect(isAdmin(ROLES.USER)).toBe(false);
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin(undefined)).toBe(false);
      expect(isAdmin("editor")).toBe(false);
    });
  });

  describe("requireAuth", () => {
    it("throws 401 Unauthorized if clerk auth has no userId", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      await expect(requireAuth()).rejects.toThrow(AppError);
      await expect(requireAuth()).rejects.toMatchObject({
        statusCode: 401,
        code: "UNAUTHORIZED",
      });
    });

    it("throws 401 if user exists in Clerk but not synced to database", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: "clerk_123" } as any);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      await expect(requireAuth()).rejects.toThrow(AppError);
      await expect(requireAuth()).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("returns internal userId and clerkId when session is valid and user exists", async () => {
      vi.mocked(auth).mockResolvedValue({ userId: "clerk_123" } as any);

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: "usr_uuid_456", clerkId: "clerk_123" },
          ]),
        }),
      });

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      const result = await requireAuth();
      expect(result).toEqual({
        userId: "usr_uuid_456",
        clerkId: "clerk_123",
      });
    });
  });

  describe("requireContractOwnership", () => {
    it("returns contract when contract is owned by user", async () => {
      const mockContract = {
        id: "ctr_111",
        userId: "usr_user_a",
        originalFilename: "agreement.pdf",
      };

      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockContract]),
        }),
      });

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      const result = await requireContractOwnership("ctr_111", "usr_user_a");
      expect(result).toEqual(mockContract);
    });

    it("throws 404 NOT_FOUND when contract does not exist or belongs to another user (anti-leak protection)", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      await expect(
        requireContractOwnership("ctr_111", "usr_user_b")
      ).rejects.toThrow(AppError);

      await expect(
        requireContractOwnership("ctr_111", "usr_user_b")
      ).rejects.toMatchObject({
        statusCode: 404,
        code: "NOT_FOUND",
      });
    });
  });

  describe("requireRole", () => {
    it("resolves without throwing when user possesses required role", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ role: "admin" }]),
        }),
      });

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      await expect(requireRole("usr_admin", "admin")).resolves.toBeUndefined();
    });

    it("throws 403 Forbidden when user does not have required role", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ role: "user" }]),
        }),
      });

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      await expect(requireRole("usr_user", "admin")).rejects.toThrow(AppError);
      await expect(requireRole("usr_user", "admin")).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    });

    it("throws 403 Forbidden when user is not found in database", async () => {
      const mockFrom = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      });

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      await expect(requireRole("usr_missing", "admin")).rejects.toThrow(AppError);
      await expect(requireRole("usr_missing", "admin")).rejects.toMatchObject({
        statusCode: 403,
        code: "FORBIDDEN",
      });
    });
  });
});
