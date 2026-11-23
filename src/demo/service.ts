import { DEMO_CONTRACTS, DEMO_REVIEWS, DEMO_FINDINGS } from "./fixtures";
import type { Contract, Review, ReviewFinding } from "@/lib/db/schema";

export class DemoService {
  private static contracts: Contract[] = [...DEMO_CONTRACTS];

  static getContracts(): Contract[] {
    return this.contracts;
  }

  static getContractById(id: string): Contract | null {
    return this.contracts.find((c) => c.id === id) || null;
  }

  static deleteContract(id: string): boolean {
    const initialLen = this.contracts.length;
    this.contracts = this.contracts.filter((c) => c.id !== id);
    return this.contracts.length < initialLen;
  }

  static getReview(contractId: string): {
    review: Review | null;
    findings: ReviewFinding[];
  } {
    const review = DEMO_REVIEWS[contractId] || null;
    const findings = review ? DEMO_FINDINGS[review.id] || [] : [];
    return { review, findings };
  }
}
