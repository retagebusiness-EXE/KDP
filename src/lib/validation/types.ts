export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  pageIndex?: number;
}

export interface ValidationReport {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Human-readable "✓ ..." lines for a passing summary, in check order. */
  passedChecks: string[];
  generatedAt: string;
}
