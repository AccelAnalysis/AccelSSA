export interface Fraction {
  numerator: bigint;
  denominator: bigint;
}

const TEN = 10n;

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x === 0n ? 1n : x;
}

export function normalize(value: Fraction): Fraction {
  if (value.denominator === 0n) throw new Error("Fraction denominator cannot be zero");
  const sign = value.denominator < 0n ? -1n : 1n;
  const divisor = gcd(value.numerator, value.denominator);
  return {
    numerator: (value.numerator / divisor) * sign,
    denominator: (value.denominator / divisor) * sign,
  };
}

export function parseDecimal(input: string): Fraction {
  const value = input.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new Error(`Invalid decimal value: ${input}`);

  const sign = match[1] === "-" ? -1n : 1n;
  const whole = match[2] ?? "0";
  const fraction = match[3] ?? "";
  const denominator = TEN ** BigInt(fraction.length);
  const numerator = BigInt(`${whole}${fraction}`) * sign;
  return normalize({ numerator, denominator });
}

export function add(a: Fraction, b: Fraction): Fraction {
  return normalize({
    numerator: a.numerator * b.denominator + b.numerator * a.denominator,
    denominator: a.denominator * b.denominator,
  });
}

export function subtract(a: Fraction, b: Fraction): Fraction {
  return add(a, { numerator: -b.numerator, denominator: b.denominator });
}

export function multiply(a: Fraction, b: Fraction): Fraction {
  return normalize({
    numerator: a.numerator * b.numerator,
    denominator: a.denominator * b.denominator,
  });
}

export function divide(a: Fraction, b: Fraction): Fraction {
  if (b.numerator === 0n) throw new Error("Cannot divide by zero");
  return normalize({
    numerator: a.numerator * b.denominator,
    denominator: a.denominator * b.numerator,
  });
}

export function compare(a: Fraction, b: Fraction): number {
  const left = a.numerator * b.denominator;
  const right = b.numerator * a.denominator;
  return left < right ? -1 : left > right ? 1 : 0;
}

export function pow(base: Fraction, exponent: number): Fraction {
  if (!Number.isInteger(exponent) || exponent < 0) throw new Error("Fraction exponent must be a non-negative integer");
  let result: Fraction = { numerator: 1n, denominator: 1n };
  let factor = normalize(base);
  let remaining = exponent;
  while (remaining > 0) {
    if (remaining % 2 === 1) result = multiply(result, factor);
    factor = multiply(factor, factor);
    remaining = Math.floor(remaining / 2);
  }
  return result;
}

export function roundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("roundDiv denominator must be positive");
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

export function fractionToRoundedInteger(value: Fraction): bigint {
  const normalized = normalize(value);
  return roundDiv(normalized.numerator, normalized.denominator);
}

export function dollarsToCents(amount: string): bigint {
  return fractionToRoundedInteger(multiply(parseDecimal(amount), { numerator: 100n, denominator: 1n }));
}

export function decimalProductToCents(quantity: string, unitCostDollars: string): bigint {
  const dollars = multiply(parseDecimal(quantity), parseDecimal(unitCostDollars));
  return fractionToRoundedInteger(multiply(dollars, { numerator: 100n, denominator: 1n }));
}

export function multiplyCentsByDecimal(cents: bigint, multiplier: string): bigint {
  return fractionToRoundedInteger(multiply({ numerator: cents, denominator: 1n }, parseDecimal(multiplier)));
}

export function applyEscalation(cents: bigint, annualRate: string, periods: number): bigint {
  const factor = pow(add({ numerator: 1n, denominator: 1n }, parseDecimal(annualRate)), periods);
  return fractionToRoundedInteger(multiply({ numerator: cents, denominator: 1n }, factor));
}

export function discountCents(cents: bigint, discountRate: string, periods: number): bigint {
  const rate = parseDecimal(discountRate);
  if (compare(rate, { numerator: -1n, denominator: 1n }) <= 0) {
    throw new Error("Discount rate must be greater than -1");
  }
  const factor = pow(add({ numerator: 1n, denominator: 1n }, rate), periods);
  return fractionToRoundedInteger(divide({ numerator: cents, denominator: 1n }, factor));
}

export function assertRatio(value: string, name: string): void {
  const ratio = parseDecimal(value);
  if (compare(ratio, { numerator: 0n, denominator: 1n }) < 0 || compare(ratio, { numerator: 1n, denominator: 1n }) > 0) {
    throw new Error(`${name} must be between 0 and 1`);
  }
}

export function sumFractions(values: Fraction[]): Fraction {
  return values.reduce(add, { numerator: 0n, denominator: 1n });
}
