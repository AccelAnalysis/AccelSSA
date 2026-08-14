export type DataAvailability<T> =
  | { state: "AVAILABLE"; value: T; observedAt?: string; retrievedAt: string }
  | { state: "STALE"; value: T; observedAt?: string; retrievedAt: string; staleSince: string; reason?: string }
  | { state: "UNAVAILABLE"; source: string; lastSuccessfulAt?: string; dataAgeSeconds?: number; retryState?: "NOT_SCHEDULED" | "QUEUED" | "RETRYING" | "FAILED"; reason: string };

export function hasUsableValue<T>(availability: DataAvailability<T>): availability is Extract<DataAvailability<T>, { state: "AVAILABLE" | "STALE" }> {
  return availability.state === "AVAILABLE" || availability.state === "STALE";
}
