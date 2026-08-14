import { describe, expect, it } from "vitest";
import { canTransitionJob, transitionJob, type BackgroundJob } from "./jobs";

const job: BackgroundJob = {
  id: "job_1",
  type: "screening.mass-geography",
  status: "QUEUED",
  payload: {},
  progress: 0,
  attempt: 0,
  maxAttempts: 3,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

describe("background job state", () => {
  it("permits normal execution transitions", () => {
    expect(canTransitionJob("QUEUED", "RUNNING")).toBe(true);
    expect(transitionJob(job, "RUNNING", "2026-01-02").status).toBe("RUNNING");
  });

  it("protects terminal states", () => {
    expect(canTransitionJob("SUCCEEDED", "RUNNING")).toBe(false);
  });
});
