/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as runsPOST, GET as runsGET } from "@/app/api/evaluation/runs/route";
import { GET as singleRunGET } from "@/app/api/evaluation/runs/[id]/route";
import { GET as dashboardGET } from "@/app/api/evaluation/dashboard/route";

// Mock @/lib/auth/protect
vi.mock("@/lib/auth/protect", () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

// Mock @/modules/evaluation
vi.mock("@/modules/evaluation", () => ({
  EvaluationRunner: {
    runEvaluation: vi.fn(),
  },
  EvaluationReporter: {
    generateMarkdownReport: vi.fn().mockReturnValue("# Markdown Report"),
  },
}));

// Mock @/lib/db
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

import { requireAuth, requireRole } from "@/lib/auth/protect";
import { EvaluationRunner } from "@/modules/evaluation";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

describe("Evaluation API Role Gates & Integration Tests", () => {
  const userId = "usr_00000000-0000-0000-0000-000000000001";
  const runId = "123e4567-e89b-12d3-a456-426614174099";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/evaluation/runs", () => {
    it("returns 401 when user is unauthenticated", async () => {
      vi.mocked(requireAuth).mockRejectedValue(AppError.unauthorized());

      const res = await runsPOST(
        new Request("http://localhost", { method: "POST" })
      );

      expect(res.status).toBe(401);
    });

    it("returns 403 when user is authenticated but not an admin", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireRole).mockRejectedValue(AppError.forbidden("Insufficient permissions"));

      const res = await runsPOST(
        new Request("http://localhost", { method: "POST" })
      );

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("Insufficient permissions");
    });

    it("returns 201 Created and triggers benchmark when user is admin", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireRole).mockResolvedValue(undefined);

      vi.mocked(EvaluationRunner.runEvaluation).mockResolvedValue({
        run: { id: runId, passRate: 0.95 } as any,
        cases: [],
        metrics: { totalCases: 32, passedCases: 30 } as any,
        reportMarkdown: "# Report",
      });

      const res = await runsPOST(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runType: "full" }),
        })
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.run.id).toBe(runId);
      expect(json.metrics.totalCases).toBe(32);
    });
  });

  describe("GET /api/evaluation/runs", () => {
    it("returns 403 when non-admin accesses list", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireRole).mockRejectedValue(AppError.forbidden());

      const res = await runsGET(new Request("http://localhost"));
      expect(res.status).toBe(403);
    });

    it("returns 200 with paginated runs list for admin", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireRole).mockResolvedValue(undefined);

      // Mock count query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([{ total: 1 }]),
      } as any);

      // Mock runs query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([{ id: runId, passRate: 0.94 }]),
            }),
          }),
        }),
      } as any);

      const res = await runsGET(new Request("http://localhost?page=1&limit=20"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.runs).toHaveLength(1);
      expect(json.pagination.total).toBe(1);
    });
  });

  describe("GET /api/evaluation/runs/[id]", () => {
    it("returns 404 when run does not exist", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireRole).mockResolvedValue(undefined);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const res = await singleRunGET(new Request("http://localhost"), {
        params: Promise.resolve({ id: runId }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 200 with run details, cases and report for admin", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireRole).mockResolvedValue(undefined);

      const mockRun = {
        id: runId,
        runType: "full",
        modelId: "google/gemini-2.5-flash",
        promptVersion: "v1",
        passRate: 1.0,
        detailedMetrics: {
          totalCases: 1,
          passedCases: 1,
          failedCases: 0,
          passRate: 1.0,
          statusAccuracy: 1.0,
          quoteValidityRate: 1.0,
          locationAccuracyRate: 1.0,
          precisionScore: 1.0,
          recallScore: 1.0,
          f1Score: 1.0,
          missingClauseDetectionRate: 1.0,
          sampleSize: 1,
          perCategory: {},
        },
        createdAt: new Date(),
      };

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockRun]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "case-1", fixtureName: "c1.txt" }]),
          }),
        } as any);

      const res = await singleRunGET(new Request("http://localhost"), {
        params: Promise.resolve({ id: runId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.run.id).toBe(runId);
      expect(json.cases).toHaveLength(1);
      expect(json.reportMarkdown).toBeDefined();
    });
  });

  describe("GET /api/evaluation/dashboard", () => {
    it("returns 403 when non-admin accesses dashboard metrics", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireRole).mockRejectedValue(AppError.forbidden());

      const res = await dashboardGET();
      expect(res.status).toBe(403);
    });

    it("returns 200 with aggregated metrics for admin", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ userId } as any);
      vi.mocked(requireRole).mockResolvedValue(undefined);

      // Total count
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([{ total: 5 }]),
      } as any);

      // Latest run
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: runId, passRate: 0.95 }]),
          }),
        }),
      } as any);

      // Recent runs
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: runId, passRate: 0.95 }]),
          }),
        }),
      } as any);

      // Averages
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([
          {
            avgPassRate: 0.92,
            avgStatusAccuracy: 0.93,
            avgQuoteValidityRate: 1.0,
            avgF1Score: 0.91,
          },
        ]),
      } as any);

      const res = await dashboardGET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.totalRuns).toBe(5);
      expect(json.latestRun.id).toBe(runId);
      expect(json.averageMetrics.passRate).toBe(0.92);
    });
  });
});
