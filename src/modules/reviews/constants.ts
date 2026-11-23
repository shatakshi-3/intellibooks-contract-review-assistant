import { CHECKLIST_ITEMS, CHECKLIST_LABELS, type ChecklistItem } from "@/lib/db/schema";

export { CHECKLIST_ITEMS, CHECKLIST_LABELS, type ChecklistItem };

export interface CategoryDefinition {
  id: ChecklistItem;
  label: string;
  description: string;
  semanticQueries: string[];
  keywordSynonyms: string[];
}

export const CATEGORY_DEFINITIONS: Record<ChecklistItem, CategoryDefinition> = {
  parties: {
    id: "parties",
    label: CHECKLIST_LABELS.parties,
    description: "Identifies the contracting parties, legal entities, corporate status, and roles (e.g. Client, Vendor, Consultant).",
    semanticQueries: [
      "contracting parties entering into this agreement",
      "by and between Client and Vendor Contractor",
      "legal entities identification corporate form",
      "effective date between the undersigned parties",
    ],
    keywordSynonyms: ["by and between", "entered into by", "parties", "hereinafter referred to as", "client", "contractor", "consultant", "vendor", "service provider"],
  },
  start_date_and_term: {
    id: "start_date_and_term",
    label: CHECKLIST_LABELS.start_date_and_term,
    description: "Identifies the effective start date, term duration, end date, or period of performance of the agreement.",
    semanticQueries: [
      "effective start date and term duration of agreement",
      "commencement date and period of performance",
      "initial term shall continue for a period of",
      "agreement shall expire or end on",
    ],
    keywordSynonyms: ["effective date", "commence on", "commencement", "initial term", "term of this agreement", "period of performance", "expiration date", "continue for"],
  },
  payment_terms: {
    id: "payment_terms",
    label: CHECKLIST_LABELS.payment_terms,
    description: "Details fees, compensation, invoicing frequency, payment due dates (e.g. Net 30), and expense reimbursements.",
    semanticQueries: [
      "fees compensation and payment terms schedule",
      "invoicing payment schedule net 30 due date",
      "rates charges billing reimbursable expenses",
      "payment shall be made within days of invoice",
    ],
    keywordSynonyms: ["fees", "payment terms", "invoicing", "invoice", "compensation", "net 30", "net 60", "reimbursement", "billing", "rate per hour", "fixed fee"],
  },
  termination: {
    id: "termination",
    label: CHECKLIST_LABELS.termination,
    description: "Specifies terms for termination with cause (e.g. breach), termination for convenience, notice periods, and post-termination obligations.",
    semanticQueries: [
      "termination for convenience or cause breach",
      "notice period to terminate agreement written notice",
      "either party may terminate this agreement upon days notice",
      "immediate termination upon material breach",
    ],
    keywordSynonyms: ["terminate", "termination", "without cause", "for convenience", "material breach", "written notice of termination", "cure period", "days' notice"],
  },
  limitation_of_liability: {
    id: "limitation_of_liability",
    label: CHECKLIST_LABELS.limitation_of_liability,
    description: "Defines liability caps, exclusion of consequential/indirect damages, and maximum aggregate liability amounts.",
    semanticQueries: [
      "limitation of liability cap maximum aggregate liability",
      "consequential incidental indirect damages disclaimer",
      "in no event shall either party be liable for loss of profits",
      "liability under this agreement shall not exceed fees paid",
    ],
    keywordSynonyms: ["limitation of liability", "indirect damages", "consequential damages", "loss of profits", "aggregate liability", "shall not exceed", "in no event shall"],
  },
  confidentiality: {
    id: "confidentiality",
    label: CHECKLIST_LABELS.confidentiality,
    description: "Specifies non-disclosure obligations, definition of confidential information, standard of care, and duration of confidentiality.",
    semanticQueries: [
      "confidential information non-disclosure obligations proprietary data",
      "recipient shall protect and maintain secrecy of confidential information",
      "confidentiality survival period standard of care",
      "exceptions to confidential information publicly known",
    ],
    keywordSynonyms: ["confidential information", "non-disclosure", "proprietary information", "trade secrets", "standard of care", "protect from disclosure", "duty of confidentiality"],
  },
  governing_law: {
    id: "governing_law",
    label: CHECKLIST_LABELS.governing_law,
    description: "Designates the governing state/federal laws, choice of law rules, venue, and jurisdiction for resolving legal disputes.",
    semanticQueries: [
      "governing law and jurisdiction for legal disputes",
      "governed by and construed in accordance with laws of State",
      "exclusive jurisdiction and venue of courts located in",
      "choice of law dispute resolution forum",
    ],
    keywordSynonyms: ["governing law", "governed by", "jurisdiction", "exclusive venue", "laws of the state", "courts located in", "choice of law", "conflict of laws"],
  },
  auto_renewal: {
    id: "auto_renewal",
    label: CHECKLIST_LABELS.auto_renewal,
    description: "Identifies automatic renewal provisions, successive term extensions, and opt-out or non-renewal notice deadlines.",
    semanticQueries: [
      "automatic renewal of agreement successive terms",
      "agreement shall automatically renew unless notice given",
      "auto-renew extension notice of non-renewal days prior",
      "renew for additional successive one year terms",
    ],
    keywordSynonyms: ["automatic renewal", "automatically renew", "auto-renewal", "successive terms", "notice of non-renewal", "automatically extend", "renewal term"],
  },
};
