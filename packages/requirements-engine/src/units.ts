import { UnitConversionError } from "./errors.js";
import type { UnitCode } from "./types.js";

type Dimension = "distance" | "duration" | "area" | "power" | "volume_flow";

interface UnitSpec {
  dimension: Dimension;
  toBase: number;
}

const UNIT_SPECS: Partial<Record<UnitCode, UnitSpec>> = {
  METER: { dimension: "distance", toBase: 1 },
  KILOMETER: { dimension: "distance", toBase: 1000 },
  MILE: { dimension: "distance", toBase: 1609.344 },
  MINUTE: { dimension: "duration", toBase: 60 },
  HOUR: { dimension: "duration", toBase: 3600 },
  SQUARE_FOOT: { dimension: "area", toBase: 1 },
  ACRE: { dimension: "area", toBase: 43560 },
  HECTARE: { dimension: "area", toBase: 107639.1041671 },
  KW: { dimension: "power", toBase: 1 },
  MW: { dimension: "power", toBase: 1000 },
  GPD: { dimension: "volume_flow", toBase: 1 },
  MGD: { dimension: "volume_flow", toBase: 1_000_000 },
  GPM: { dimension: "volume_flow", toBase: 1440 },
};

export function areUnitsCompatible(from: UnitCode | undefined, to: UnitCode | undefined): boolean {
  if (!from || !to) return from === to || !from || !to;
  if (from === to) return true;
  const left = UNIT_SPECS[from];
  const right = UNIT_SPECS[to];
  return Boolean(left && right && left.dimension === right.dimension);
}

export function convertUnit(value: number, from: UnitCode, to: UnitCode): number {
  if (from === to) return value;
  const left = UNIT_SPECS[from];
  const right = UNIT_SPECS[to];
  if (!left || !right || left.dimension !== right.dimension) {
    throw new UnitConversionError(`Cannot convert ${from} to ${to}.`);
  }
  return (value * left.toBase) / right.toBase;
}
