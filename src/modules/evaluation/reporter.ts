/**
 * Evaluation Reporter.
 *
 * Generates formatted Markdown and JSON evaluation reports
 * suitable for the QA Dashboard and CI/CD artifacts.
 */

import type { EvaluationCaseComparison, EvaluationMetricsSummary } from "./comparator";
import { CHECKLIST_LABELS } from "@/modules/reviews/constants";

export interface EvaluationReportMetadata {
  runId: string;
  runType: string;
  modelId: string;
  promptVersion: string;
  embeddingModel?: string;
  durationMs: number;
  timestamp: string;
}

export class EvaluationReporter {
  /**
   * Generate an automated Markdown evaluation report.
   */
  static generateMarkdownReport(
    metadata: EvaluationReportMetadata,
    metrics: EvaluationMetricsSummary,
    cases: EvaluationCaseComparison[]
  ): string {
    const lines: string[] = [];

    const passRate = metrics?.passRate ?? 0;
    const passedCases = metrics?.passedCases ?? 0;
    const totalCases = metrics?.totalCases ?? 0;
    const statusAccuracy = metrics?.statusAccuracy ?? 0;
    const precisionScore = metrics?.precisionScore ?? 0;
    const recallScore = metrics?.recallScore ?? 0;
    const f1Score = metrics?.f1Score ?? 0;
    const quoteValidityRate = metrics?.quoteValidityRate ?? 0;
    const missingClauseDetectionRate = metrics?.missingClauseDetectionRate ?? 0;
    const sampleSize = metrics?.sampleSize ?? totalCases;
    const perCategory = metrics?.perCategory || {};

    lines.push(`# IntelliBooks QA Evaluation Benchmark Report`);
    lines.push(`\n**Run ID:** \`${metadata.runId}\`  `);
    lines.push(`**Executed At:** ${metadata.timestamp}  `);
    lines.push(`**Model:** \`${metadata.modelId}\` | **Prompt Version:** \`${metadata.promptVersion}\`  `);
    lines.push(`**Duration:** ${metadata.durationMs}ms | **Benchmark Sample Size:** ${sampleSize} test cases\n`);

    lines.push(`## 1. High-Level Performance Metrics\n`);
    lines.push(`| Metric | Value | Target | Status |`);
    lines.push(`|---|---|---|---|`);
    lines.push(
      `| **Overall Pass Rate** | ${(passRate * 100).toFixed(1)}% (${passedCases}/${totalCases}) | ≥ 90.0% | ${
        passRate >= 0.9 ? "PASS" : "WARN"
      } |`
    );
    lines.push(
      `| **Status Accuracy** | ${(statusAccuracy * 100).toFixed(1)}% | ≥ 90.0% | ${
        statusAccuracy >= 0.9 ? "PASS" : "WARN"
      } |`
    );
    lines.push(
      `| **Precision Score** | ${(precisionScore * 100).toFixed(1)}% | ≥ 90.0% | ${
        precisionScore >= 0.9 ? "PASS" : "WARN"
      } |`
    );
    lines.push(
      `| **Recall Score** | ${(recallScore * 100).toFixed(1)}% | ≥ 90.0% | ${
        recallScore >= 0.9 ? "PASS" : "WARN"
      } |`
    );
    lines.push(
      `| **F1 Score** | ${(f1Score * 100).toFixed(1)}% | ≥ 90.0% | ${
        f1Score >= 0.9 ? "PASS" : "WARN"
      } |`
    );
    lines.push(
      `| **Quote Validity Rate** | ${(quoteValidityRate * 100).toFixed(1)}% | 100.0% | ${
        quoteValidityRate >= 0.95 ? "PASS" : "FAIL"
      } |`
    );
    lines.push(
      `| **Missing Clause Detection** | ${(missingClauseDetectionRate * 100).toFixed(1)}% | ≥ 90.0% | ${
        missingClauseDetectionRate >= 0.9 ? "PASS" : "WARN"
      } |`
    );

    lines.push(`\n## 2. Per-Category Breakdown\n`);
    lines.push(`| Checklist Category | True Pos | False Pos | False Neg | True Neg | Precision | Recall | F1 Score |`);
    lines.push(`|---|---|---|---|---|---|---|---|`);

    for (const [cat, data] of Object.entries(perCategory)) {
      const label = CHECKLIST_LABELS[cat as keyof typeof CHECKLIST_LABELS] || cat;
      lines.push(
        `| **${label}** | ${data.truePositives} | ${data.falsePositives} | ${data.falseNegatives} | ${data.trueNegatives} | ${(
          data.precision * 100
        ).toFixed(1)}% | ${(data.recall * 100).toFixed(1)}% | ${(data.f1 * 100).toFixed(1)}% |`
      );
    }

    // Failed Cases
    const failedCases = cases.filter((c) => !c.passed);
    lines.push(`\n## 3. Case Failure Investigations (${failedCases.length} Cases)\n`);

    if (failedCases.length === 0) {
      lines.push(`Zero failures detected across all benchmark fixtures.`);
    } else {
      lines.push(`| Fixture | Category | Expected Status | Actual Status | Failure Explanation |`);
      lines.push(`|---|---|---|---|---|`);
      for (const fc of failedCases) {
        const label = CHECKLIST_LABELS[fc.checklistItem] || fc.checklistItem;
        lines.push(
          `| \`${fc.fixtureName}\` | ${label} | \`${fc.expectedStatus}\` | \`${fc.actualStatus}\` | ${
            fc.failureReason || "N/A"
          } |`
        );
      }
    }

    lines.push(`\n---\n*Report generated automatically by IntelliBooks QA Evaluation Pipeline.*`);

    return lines.join("\n");
  }

  /**
   * Generate structured JSON report.
   */
  static generateJsonReport(
    metadata: EvaluationReportMetadata,
    metrics: EvaluationMetricsSummary,
    cases: EvaluationCaseComparison[]
  ) {
    return {
      metadata,
      metrics,
      cases,
    };
  }
}
