import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function viewerContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "local-viewer",
      email: "viewer@example.com",
      name: "Viewer",
      loginMethod: "password",
      passwordHash: null,
      role: "user",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      organizationId: "org-test",
      organizationName: "Organização de teste",
      organizationSlug: "org-test",
      organizationRole: "viewer",
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("governance authorization", () => {
  it("blocks a viewer from resolving a discrepancy", async () => {
    const caller = appRouter.createCaller(viewerContext());
    await expect(caller.dataControl.resolveDiscrepancy({ id: "disc-1", status: "resolved", justification: "Evidência documentada para teste" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks a viewer from accessing the member directory", async () => {
    const caller = appRouter.createCaller(viewerContext());
    await expect(caller.organization.members()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
