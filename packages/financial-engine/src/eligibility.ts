import { compare, parseDecimal } from "./decimal.js";
import type {
  EligibilityRuleResult,
  EligibilityStatus,
  IncentiveEligibilityResult,
  IncentiveEligibilityRule,
} from "./types.js";

function requireValue(value: string | undefined, rule: IncentiveEligibilityRule, field: string): string {
  if (value === undefined) throw new Error(`Eligibility rule ${rule.id} requires ${field}`);
  return value;
}

function evaluateNumericRule(rule: IncentiveEligibilityRule, actual: string): boolean {
  const actualValue = parseDecimal(actual);
  switch (rule.operator) {
    case "EQ":
      return compare(actualValue, parseDecimal(requireValue(rule.target, rule, "target"))) === 0;
    case "GTE":
      return compare(actualValue, parseDecimal(requireValue(rule.target, rule, "target"))) >= 0;
    case "GT":
      return compare(actualValue, parseDecimal(requireValue(rule.target, rule, "target"))) > 0;
    case "LTE":
      return compare(actualValue, parseDecimal(requireValue(rule.target, rule, "target"))) <= 0;
    case "LT":
      return compare(actualValue, parseDecimal(requireValue(rule.target, rule, "target"))) < 0;
    case "BETWEEN": {
      const minimum = parseDecimal(requireValue(rule.minimum, rule, "minimum"));
      const maximum = parseDecimal(requireValue(rule.maximum, rule, "maximum"));
      if (compare(minimum, maximum) > 0) throw new Error(`Eligibility rule ${rule.id} minimum cannot exceed maximum`);
      return compare(actualValue, minimum) >= 0 && compare(actualValue, maximum) <= 0;
    }
  }
}

export function evaluateEligibilityRule(
  rule: IncentiveEligibilityRule,
  facts: Readonly<Record<string, string | undefined>>,
): EligibilityRuleResult {
  const actual = facts[rule.factKey];
  if (actual === undefined) {
    return {
      ruleId: rule.id,
      status: "UNKNOWN",
      explanation: `${rule.description}: required project fact '${rule.factKey}' is missing`,
    };
  }

  const passed = evaluateNumericRule(rule, actual);
  const status: EligibilityStatus = passed
    ? (rule.requiresAuthorityConfirmation ? "REQUIRES_AUTHORITY_CONFIRMATION" : "PASS")
    : "FAIL";

  return {
    ruleId: rule.id,
    status,
    actual,
    explanation: passed
      ? `${rule.description}: project value ${actual} satisfies the configured rule`
      : `${rule.description}: project value ${actual} does not satisfy the configured rule`,
  };
}

export function evaluateIncentiveEligibility(
  rules: IncentiveEligibilityRule[],
  facts: Readonly<Record<string, string | undefined>>,
): IncentiveEligibilityResult {
  const ruleResults = rules.map((rule) => evaluateEligibilityRule(rule, facts));
  let status: EligibilityStatus = "PASS";

  if (ruleResults.some((result) => result.status === "FAIL")) status = "FAIL";
  else if (ruleResults.some((result) => result.status === "UNKNOWN")) status = "UNKNOWN";
  else if (ruleResults.some((result) => result.status === "REQUIRES_AUTHORITY_CONFIRMATION")) {
    status = "REQUIRES_AUTHORITY_CONFIRMATION";
  }

  return { status, ruleResults };
}
