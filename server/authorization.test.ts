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

function roleContext(role: "owner" | "admin" | "analyst" | "operator" | "viewer"): TrpcContext {
  const context = viewerContext();
  const user = context.user!;
  return { user: { ...user, organizationRole: role }, req: context.req, res: context.res };
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

  it("blocks viewers and analysts from receiving or mapping imports", async () => {
    const input = {
      filename: "base.csv",
      mimeType: "text/csv",
      contentBase64: Buffer.from("0123456789012345").toString("base64"),
      targetEntity: "livestock_lot" as const,
    };
    await expect(appRouter.createCaller(roleContext("viewer")).imports.upload(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(roleContext("analyst")).imports.map({ id: "batch-1", mapping: {} })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows approval only to owner and admin procedures", async () => {
    await expect(appRouter.createCaller(roleContext("operator")).imports.commit({ id: "batch-1", confirm: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(roleContext("viewer")).imports.cancel({ id: "batch-1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
