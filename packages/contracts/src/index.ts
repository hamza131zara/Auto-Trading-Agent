/** State vocabulary shared by future adapters and UI. Types only; no trade or risk logic. */
export type AssessmentState =
  | "PASS"
  | "WARN"
  | "FAIL"
  | "UNKNOWN"
  | "NOT_TESTED"
  | "BLOCKED";

/** A decision proposal outcome; model output is advisory and cannot authorize execution. */
export type DecisionOutcome =
  | "NO_TRADE"
  | "RESEARCH_MORE"
  | "PROPOSE_TRADE";
