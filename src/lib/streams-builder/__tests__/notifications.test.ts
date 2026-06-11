import { describe, expect, it } from "vitest";
import { deriveStreamsBuilderNotifications, setStreamsBuilderNotificationRead } from "../notifications";

describe("Streams Builder notifications", () => {
  it("derives approval notifications from activity records", () => {
    const notifications = deriveStreamsBuilderNotifications([
      {
        id: "activity-1",
        projectId: "project-1",
        sessionId: "session-1",
        actorUserId: "user-1",
        actionType: "builder_gate_result_approved",
        previousState: null,
        nextState: "approved",
        truthState: "PROVEN",
        message: "Approved",
        createdAt: "2026-01-01T00:00:00.000Z",
        sourceJobId: "job-1",
      },
    ]);

    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("approval_approved");
    expect(notifications[0].severity).toBe("success");
    expect(notifications[0].read).toBe(false);
  });

  it("records deterministic read state", () => {
    const result = setStreamsBuilderNotificationRead({ notificationId: "n-1", read: true });
    expect(result.notificationId).toBe("n-1");
    expect(result.read).toBe(true);
    expect(result.truthState).toBe("UNPROVEN");
  });
});
