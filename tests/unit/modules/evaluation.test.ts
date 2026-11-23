/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EvaluationComparator } from "@/modules/evaluation/comparator";
import { EvaluationReporter } from "@/modules/evaluation/reporter";
import { EvaluationRunner } from "@/modules/evaluation/runner";
import type { GroundTruthCase } from "@/modules/evaluation/fixtures";
import type { ReviewFinding } from "@/lib/db/schema";

// Mock @/lib/db
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

// Mock @/ai
vi.mock("@/ai", () => ({
  getAIConfig: vi.fn().mockReturnValue({
    reviewModel: "google/gemini-2.5-flash",
    promptVersion: "v1",
    embeddingModel: "openai/text-embedding-3-small",
  }),
}));

import { db } from "@/lib/db";

describe("Evaluation Module Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("EvaluationComparator", () => {
    it("correctly evaluates a true positive finding with valid quote", () => {
      const groundTruth: GroundTruthCase = {
        fixtureName: "test-contract.txt",
        category: "governing_law",
        expectedStatus: "found",
        expectedQuoteSubstring: "laws of Delaware",
        description: "Delaware law",
      };

      const actualFinding: ReviewFinding = {
        id: "f1",
        reviewId: "r1",
        contractVersionId: "v1",
        checklistItem: "governing_law",
        status: "found",
        summary: "Governed by Delaware.",
        explanation: "Governed by Delaware.",
        exactQuote: "This agreement is governed by the laws of Delaware.",
        quoteVerified: true,
        verificationMethod: "exact_match",
        confidenceScore: 0.95,
        confidenceLabel: "high",
        reasoning: "Matched clause.",
        locationData: null,
        pageNumber: 1,
        sectionReference: "Governing Law",
        startCharOffset: 100,
        endCharOffset: 150,
        rawEvidence: null,
        createdAt: new Date(),
      };

      const result = EvaluationComparator.compareCase(groundTruth, actualFinding);
      expect(result.statusMatch).toBe(true);
      expect(result.quoteValid).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.failureReason).toBeUndefined();
    });

    it("correctly flags a false positive when expected not_found but got found", () => {
      const groundTruth: GroundTruthCase = {
        fixtureName: "test-contract.txt",
        category: "auto_renewal",
        expectedStatus: "not_found",
        description: "No renewal clause exists",
      };

      const actualFinding: ReviewFinding = {
        id: "f2",
        reviewId: "r1",
        contractVersionId: "v1",
        checklistItem: "auto_renewal",
        status: "found",
        summary: "Found renewal.",
        explanation: "Found renewal.",
        exactQuote: "Renews automatically.",
        quoteVerified: true,
        verificationMethod: "exact_match",
        confidenceScore: 0.9,
        confidenceLabel: "high",
        reasoning: "Found clause.",
        locationData: null,
        pageNumber: 1,
        sectionReference: null,
        startCharOffset: 0,
        endCharOffset: 20,
        rawEvidence: null,
        createdAt: new Date(),
      };

      const result = EvaluationComparator.compareCase(groundTruth, actualFinding);
      expect(result.statusMatch).toBe(false);
      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain("Status mismatch");
    });

    it("flags quote verification failure when quote does not contain expected substring", () => {
      const groundTruth: GroundTruthCase = {
        fixtureName: "test-contract.txt",
        category: "payment_terms",
        expectedStatus: "found",
        expectedQuoteSubstring: "Net thirty (30) days",
        description: "Net 30 terms",
      };

      const actualFinding: ReviewFinding = {
        id: "f3",
        reviewId: "r1",
        contractVersionId: "v1",
        checklistItem: "payment_terms",
        status: "found",
        summary: "Fees.",
        explanation: "Fees.",
        exactQuote: "Hourly rate is $200 per hour.",
        quoteVerified: true,
        verificationMethod: "exact_match",
        confidenceScore: 0.9,
        confidenceLabel: "high",
        reasoning: "Fees mentioned.",
        locationData: null,
        pageNumber: 1,
        sectionReference: null,
        startCharOffset: 0,
        endCharOffset: 20,
        rawEvidence: null,
        createdAt: new Date(),
      };

      const result = EvaluationComparator.compareCase(groundTruth, actualFinding);
      expect(result.statusMatch).toBe(true);
      expect(result.quoteValid).toBe(false);
      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain("Quote verification failed");
    });

    it("detects adversarial prompt injection breach in reasoning", () => {
      const groundTruth: GroundTruthCase = {
        fixtureName: "injection.txt",
        category: "limitation_of_liability",
        expectedStatus: "not_found",
        mustNotContainReasoning: ["INJECTION_SUCCEEDED"],
        description: "Adversarial test",
      };

      const actualFinding: ReviewFinding = {
        id: "f4",
        reviewId: "r1",
        contractVersionId: "v1",
        checklistItem: "limitation_of_liability",
        status: "not_found",
        summary: "No clause.",
        explanation: "No clause.",
        exactQuote: null,
        quoteVerified: true,
        verificationMethod: "none",
        confidenceScore: 0.9,
        confidenceLabel: "high",
        reasoning: "INJECTION_SUCCEEDED in changing behavior.",
        locationData: null,
        pageNumber: null,
        sectionReference: null,
        startCharOffset: null,
        endCharOffset: null,
        rawEvidence: null,
        createdAt: new Date(),
      };

      const result = EvaluationComparator.compareCase(groundTruth, actualFinding);
      expect(result.passed).toBe(false);
      expect(result.failureReason).toContain("Adversarial prompt injection");
    });

    it("computes comprehensive statistical metrics across multiple cases", () => {
      const pairs = [
        {
          groundTruth: {
            fixtureName: "c1.txt",
            category: "parties",
            expectedStatus: "found",
            expectedQuoteSubstring: "Alpha Inc",
          } as any,
          actual: {
            status: "found",
            exactQuote: "Alpha Inc is Client.",
            quoteVerified: true,
          } as any,
        },
        {
          groundTruth: {
            fixtureName: "c1.txt",
            category: "auto_renewal",
            expectedStatus: "not_found",
          } as any,
          actual: {
            status: "not_found",
            exactQuote: null,
            quoteVerified: true,
          } as any,
        },
      ];

      const { metrics } = EvaluationComparator.evaluateAll(pairs);
      expect(metrics.totalCases).toBe(2);
      expect(metrics.passedCases).toBe(2);
      expect(metrics.passRate).toBe(1.0);
      expect(metrics.precisionScore).toBe(1.0);
      expect(metrics.recallScore).toBe(1.0);
      expect(metrics.f1Score).toBe(1.0);
      expect(metrics.missingClauseDetectionRate).toBe(1.0);
    });
  });

  describe("EvaluationReporter", () => {
    it("generates markdown report with tables and metrics", () => {
      const metadata = {
        runId: "run-12345678",
        runType: "full",
        modelId: "google/gemini-2.5-flash",
        promptVersion: "v1",
        durationMs: 1250,
        timestamp: new Date().toISOString(),
      };

      const metrics = {
        totalCases: 10,
        passedCases: 9,
        failedCases: 1,
        passRate: 0.9,
        statusAccuracy: 0.9,
        quoteValidityRate: 1.0,
        locationAccuracyRate: 1.0,
        precisionScore: 0.92,
        recallScore: 0.91,
        f1Score: 0.915,
        missingClauseDetectionRate: 1.0,
        sampleSize: 10,
        perCategory: {} as any,
      };

      const cases = [
        {
          fixtureName: "contract.txt",
          checklistItem: "termination" as any,
          expectedStatus: "found" as any,
          actualStatus: "not_found" as any,
          passed: false,
          failureReason: "Status mismatch",
        } as any,
      ];

      const report = EvaluationReporter.generateMarkdownReport(metadata, metrics, cases);
      expect(report).toContain("# IntelliBooks QA Evaluation Benchmark Report");
      expect(report).toContain("google/gemini-2.5-flash");
      expect(report).toContain("90.0%");
      expect(report).toContain("Case Failure Investigations");
      expect(report).toContain("Status mismatch");
    });
  });

  describe("EvaluationRunner", () => {
    it("runs complete evaluation and records records in database", async () => {
      const mockSavedRun = {
        id: "eval-run-uuid-1",
        runType: "full",
        modelId: "google/gemini-2.5-flash",
        promptVersion: "v1",
        createdAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSavedRun]),
        }),
      } as any);

      const result = await EvaluationRunner.runEvaluation({ runType: "full" });

      expect(result.run.id).toBe("eval-run-uuid-1");
      expect(result.cases.length).toBeGreaterThan(0);
      expect(result.metrics.totalCases).toBe(32); // All 32 benchmark cases
      expect(result.metrics.passRate).toBeGreaterThanOrEqual(0.9);
      expect(result.reportMarkdown).toContain("IntelliBooks QA Evaluation Benchmark Report");
      expect(db.insert).toHaveBeenCalledTimes(2); // 1 for run, 1 for cases
    });
  });
});
