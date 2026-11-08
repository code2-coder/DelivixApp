/**
 * Products occasionally arrive with a legacy `returnPolicy` shape
 * (`{ isReturnable, returnWindowDays }`) even though the schema stores a
 * plain string. Rendering that object directly crashes React, so every
 * display surface goes through this formatter.
 */
export function formatReturnPolicy(value: unknown, fallback = "Easy returns"): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (value && typeof value === "object") {
    const policy = value as {
      isReturnable?: unknown;
      returnWindowDays?: unknown;
      days?: unknown;
    };
    const days = Number(policy.returnWindowDays ?? policy.days);

    if (Number.isFinite(days) && days > 0) {
      return `${days}-day returns`;
    }
    if (policy.isReturnable === false) {
      return "Non-returnable";
    }
    return fallback;
  }

  return fallback;
}
