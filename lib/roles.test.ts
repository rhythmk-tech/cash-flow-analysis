import { describe, expect, it } from "vitest";
import { canAssignRole, canChangeRoles, canEditData, canManageTeam, canRemoveMember, isAssignableRole } from "./roles";

describe("isAssignableRole", () => {
  it("accepts admin, editor, viewer", () => {
    expect(isAssignableRole("admin")).toBe(true);
    expect(isAssignableRole("editor")).toBe(true);
    expect(isAssignableRole("viewer")).toBe(true);
  });
  it("rejects owner and garbage", () => {
    expect(isAssignableRole("owner")).toBe(false);
    expect(isAssignableRole("superadmin")).toBe(false);
    expect(isAssignableRole(undefined)).toBe(false);
    expect(isAssignableRole(42)).toBe(false);
  });
});

describe("canEditData", () => {
  it("allows owner, admin, editor to write data", () => {
    expect(canEditData("owner")).toBe(true);
    expect(canEditData("admin")).toBe(true);
    expect(canEditData("editor")).toBe(true);
  });
  it("blocks viewer from writing data", () => {
    expect(canEditData("viewer")).toBe(false);
  });
});

describe("canManageTeam", () => {
  it("allows owner and admin", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("admin")).toBe(true);
  });
  it("blocks editor and viewer", () => {
    expect(canManageTeam("editor")).toBe(false);
    expect(canManageTeam("viewer")).toBe(false);
  });
});

describe("canChangeRoles", () => {
  it("is owner-only", () => {
    expect(canChangeRoles("owner")).toBe(true);
    expect(canChangeRoles("admin")).toBe(false);
    expect(canChangeRoles("editor")).toBe(false);
    expect(canChangeRoles("viewer")).toBe(false);
  });
});

describe("canAssignRole", () => {
  it("lets the owner assign any role, including admin", () => {
    expect(canAssignRole("owner", "admin")).toBe(true);
    expect(canAssignRole("owner", "editor")).toBe(true);
    expect(canAssignRole("owner", "viewer")).toBe(true);
  });

  it("lets an admin assign editor/viewer but never admin (closes the escalation loophole)", () => {
    expect(canAssignRole("admin", "editor")).toBe(true);
    expect(canAssignRole("admin", "viewer")).toBe(true);
    expect(canAssignRole("admin", "admin")).toBe(false);
  });

  it("editors and viewers can't assign any role", () => {
    expect(canAssignRole("editor", "viewer")).toBe(false);
    expect(canAssignRole("viewer", "viewer")).toBe(false);
  });
});

describe("canRemoveMember", () => {
  it("owner can remove admins, editors, and viewers", () => {
    expect(canRemoveMember("owner", "admin")).toBe(true);
    expect(canRemoveMember("owner", "editor")).toBe(true);
    expect(canRemoveMember("owner", "viewer")).toBe(true);
  });

  it("admin can remove editors and viewers but not other admins", () => {
    expect(canRemoveMember("admin", "editor")).toBe(true);
    expect(canRemoveMember("admin", "viewer")).toBe(true);
    expect(canRemoveMember("admin", "admin")).toBe(false);
  });

  it("editors and viewers can't remove anyone", () => {
    expect(canRemoveMember("editor", "viewer")).toBe(false);
    expect(canRemoveMember("viewer", "viewer")).toBe(false);
  });
});
