/**
 * Evaluation Comparator.
 *
 * Compares actual review findings against ground truth labels and computes
 * statistical performance metrics: Precision, Recall, F1, Quote Validity,
 * and Missing Clause Detection.
 */

import type { GroundTruthCase } from "./fixtures";
import type { ReviewFinding, ChecklistItem, FindingStatus } from "@/lib/db/schema";
import { CHECKLIST_ITEMS } from "@/modules/reviews/constants";

export interface EvaluationCaseComparison {
  fixtureName: string;
  checklistItem: ChecklistItem;
  expectedStatus: FindingStatus;
  actualStatus: FindingStatus;
  statusMatch: boolean;
  expectedQuoteSubstring?: string;
  actualQuote: string | null;
  quoteValid: boolean;
  locationAccurate: boolean;
  expectedPage?: number;
  actualPage?: number | null;
  passed: boolean;
  failureReason?: string;
  rawComparison: Record<string, unknown>;
}

export interface CategoryMetric {
  category: ChecklistItem;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface EvaluationMetricsSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;
  statusAccuracy: number;
  quoteValidityRate: number;
  locationAccuracyRate: number;
  precisionScore: number;
  recallScore: number;
  f1Score: number;
  missingClauseDetectionRate: number;
  sampleSize: number;
  perCategory: Record<ChecklistItem, CategoryMetric>;
}

export class EvaluationComparator {
  /**
   * Compare a single evaluated finding against a ground truth case.
   */
  static compareCase(
    groundTruth: GroundTruthCase,
    actual: ReviewFinding | null
  ): EvaluationCaseComparison {
    const actualStatus: FindingStatus = (actual?.status as FindingStatus) || "not_found";
    const statusMatch = actualStatus === groundTruth.expectedStatus;

    const actualQuote = actual?.exactQuote || null;
    let quoteValid = false;

    if (groundTruth.expectedStatus === "found") {
      // Must have verified quote and if expected substring provided, must contain it
      if (actual?.quoteVerified && actualQuote) {
        if (groundTruth.expectedQuoteSubstring) {
          const normActual = actualQuote.toLowerCase().replace(/\s+/g, " ");
          const normExpected = groundTruth.expectedQuoteSubstring.toLowerCase().replace(/\s+/g, " ");
          quoteValid = normActual.includes(normExpected);
        } else {
          quoteValid = true;
        }
      }
    } else {
      // For not_found or unclear, valid quote means no quote or quote is null
      quoteValid = actualQuote === null || actualQuote === "";
    }

    // Location accuracy check (if expectedPage specified)
    let locationAccurate = true;
    if (groundTruth.expectedPage && actual?.pageNumber) {
      locationAccurate = actual.pageNumber === groundTruth.expectedPage;
    }

    // Adversarial injection check
    let injectionPrevented = true;
    if (groundTruth.mustNotContainReasoning && actual?.reasoning) {
      for (const forbidden of groundTruth.mustNotContainReasoning) {
        if (actual.reasoning.includes(forbidden)) {
          injectionPrevented = false;
        }
      }
    }

    // A case is considered passed when:
    // 1. Status matches ground truth (or if expected is found, quote is valid)
    // 2. Quote is valid (no fabricated or unverified quote)
    // 3. Location is accurate
    // 4. Any adversarial override attempt was resisted
    let passed = statusMatch && quoteValid && locationAccurate && injectionPrevented;

    let failureReason: string | undefined;
    if (!statusMatch) {
      failureReason = `Status mismatch: expected '${groundTruth.expectedStatus}', got '${actualStatus}'`;
    } else if (!quoteValid) {
      failureReason = groundTruth.expectedStatus === "found"
        ? `Quote verification failed or missing expected text: "${groundTruth.expectedQuoteSubstring || 'N/A'}"`
        : `Unexpected quote provided for non-found finding`;
    } else if (!locationAccurate) {
      failureReason = `Location mismatch: expected page ${groundTruth.expectedPage}, got ${actual?.pageNumber}`;
    } else if (!injectionPrevented) {
      failureReason = `Adversarial prompt injection succeeded in overriding reasoning`;
      passed = false;
    }

    return {
      fixtureName: groundTruth.fixtureName,
      checklistItem: groundTruth.category,
      expectedStatus: groundTruth.expectedStatus,
      actualStatus,
      statusMatch,
      expectedQuoteSubstring: groundTruth.expectedQuoteSubstring,
      actualQuote,
      quoteValid,
      locationAccurate,
      expectedPage: groundTruth.expectedPage,
      actualPage: actual?.pageNumber,
      passed,
      failureReason,
      rawComparison: {
        description: groundTruth.description,
        verifiedMethod: actual?.verificationMethod,
        confidence: actual?.confidenceLabel,
        confidenceScore: actual?.confidenceScore,
      },
    };
  }

  /**
   * Compare all pairs and compute global and per-category metrics.
   */
  static evaluateAll(
    evalPairs: Array<{ groundTruth: GroundTruthCase; actual: ReviewFinding | null }>
  ): {
    comparisons: EvaluationCaseComparison[];
    metrics: EvaluationMetricsSummary;
  } {
    const comparisons: EvaluationCaseComparison[] = evalPairs.map((p) =>
      this.compareCase(p.groundTruth, p.actual)
    );

    const totalCases = comparisons.length;
    const passedCases = comparisons.filter((c) => c.passed).length;
    const failedCases = totalCases - passedCases;
    const passRate = totalCases > 0 ? Number((passedCases / totalCases).toFixed(4)) : 0;

    const statusMatchCount = comparisons.filter((c) => c.statusMatch).length;
    const statusAccuracy = totalCases > 0 ? Number((statusMatchCount / totalCases).toFixed(4)) : 0;

    // Quote validity: among cases expected to be 'found'
    const foundExpectedCases = comparisons.filter((c) => c.expectedStatus === "found");
    const validFoundQuotes = foundExpectedCases.filter((c) => c.quoteValid).length;
    const quoteValidityRate =
      foundExpectedCases.length > 0
        ? Number((validFoundQuotes / foundExpectedCases.length).toFixed(4))
        : 1.0;

    // Missing clause detection: among cases expected to be 'not_found'
    const notFoundExpectedCases = comparisons.filter((c) => c.expectedStatus === "not_found");
    const detectedNotFound = notFoundExpectedCases.filter((c) => c.actualStatus === "not_found").length;
    const missingClauseDetectionRate =
      notFoundExpectedCases.length > 0
        ? Number((detectedNotFound / notFoundExpectedCases.length).toFixed(4))
        : 1.0;

    // Location accuracy rate
    const locationCheckedCases = comparisons.filter((c) => c.expectedPage !== undefined);
    const locationAccurateCount = locationCheckedCases.filter((c) => c.locationAccurate).length;
    const locationAccuracyRate =
      locationCheckedCases.length > 0
        ? Number((locationAccurateCount / locationCheckedCases.length).toFixed(4))
        : 1.0;

    // Calculate Precision, Recall, F1 for finding presence (Positive = 'found')
    let totalTP = 0;
    let totalFP = 0;
    let totalFN = 0;

    const perCategory = {} as Record<ChecklistItem, CategoryMetric>;

    for (const cat of CHECKLIST_ITEMS) {
      const catCases = comparisons.filter((c) => c.checklistItem === cat);
      let tp = 0;
      let fp = 0;
      let fn = 0;
      let tn = 0;

      for (const item of catCases) {
        const isExpFound = item.expectedStatus === "found";
        const isActFound = item.actualStatus === "found";

        if (isExpFound && isActFound) {
          tp++;
        } else if (!isExpFound && isActFound) {
          fp++;
        } else if (isExpFound && !isActFound) {
          fn++;
        } else {
          tn++;
        }
      }

      const precision = tp + fp > 0 ? tp / (tp + fp) : 1.0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 1.0;
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 1.0;

      perCategory[cat] = {
        category: cat,
        truePositives: tp,
        falsePositives: fp,
        falseNegatives: fn,
        trueNegatives: tn,
        precision: Number(precision.toFixed(4)),
        recall: Number(recall.toFixed(4)),
        f1: Number(f1.toFixed(4)),
      };

      totalTP += tp;
      totalFP += fp;
      totalFN += fn;
    }

    const precisionScore =
      totalTP + totalFP > 0 ? Number((totalTP / (totalTP + totalFP)).toFixed(4)) : 1.0;
    const recallScore =
      totalTP + totalFN > 0 ? Number((totalTP / (totalTP + totalFN)).toFixed(4)) : 1.0;
    const f1Score =
      precisionScore + recallScore > 0
        ? Number(((2 * precisionScore * recallScore) / (precisionScore + recallScore)).toFixed(4))
        : 1.0;

    const metrics: EvaluationMetricsSummary = {
      totalCases,
      passedCases,
      failedCases,
      passRate,
      statusAccuracy,
      quoteValidityRate,
      locationAccuracyRate,
      precisionScore,
      recallScore,
      f1Score,
      missingClauseDetectionRate,
      sampleSize: totalCases,
      perCategory,
    };

    return { comparisons, metrics };
  }
}
