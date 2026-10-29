import type { AssessmentState, DecisionOutcome } from "../src/index.js";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;

type Expect<Value extends true> = Value;

type ExpectedAssessmentState =
  | "PASS"
  | "WARN"
  | "FAIL"
  | "UNKNOWN"
  | "NOT_TESTED"
  | "BLOCKED";

type ExpectedDecisionOutcome =
  | "NO_TRADE"
  | "RESEARCH_MORE"
  | "PROPOSE_TRADE";

// These exact-union assertions make safety-sensitive vocabulary changes explicit.
type AssessmentStateMustRemainExplicit = Expect<Equal<AssessmentState, ExpectedAssessmentState>>;
type DecisionOutcomeMustRemainAdvisoryOnly = Expect<Equal<DecisionOutcome, ExpectedDecisionOutcome>>;

const validAssessmentStates = [
  "PASS",
  "WARN",
  "FAIL",
  "UNKNOWN",
  "NOT_TESTED",
  "BLOCKED"
] as const satisfies readonly AssessmentState[];

const validDecisionOutcomes = [
  "NO_TRADE",
  "RESEARCH_MORE",
  "PROPOSE_TRADE"
] as const satisfies readonly DecisionOutcome[];

void validAssessmentStates;
void validDecisionOutcomes;

// @ts-expect-error Execution must never be represented as an advisory decision outcome.
const forbiddenExecutionOutcome: DecisionOutcome = "EXECUTE_TRADE";

// @ts-expect-error Arbitrary runtime states must not enter the shared contract.
const unsupportedAssessmentState: AssessmentState = "EXECUTED";

void forbiddenExecutionOutcome;
void unsupportedAssessmentState;
