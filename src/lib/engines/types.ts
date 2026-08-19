export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}
