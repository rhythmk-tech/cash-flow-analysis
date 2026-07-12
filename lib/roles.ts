// Role hierarchy: owner > admin > editor > viewer.
// The owner is implicit (userId === companyId on the session) and never stored as a role
// value — "admin" | "editor" | "viewer" are the only roles a team member can hold.
export type MemberRole = "admin" | "editor" | "viewer";
export type EffectiveRole = "owner" | MemberRole;

export const ASSIGNABLE_ROLES: MemberRole[] = ["admin", "editor", "viewer"];

export const ROLE_LABELS: Record<EffectiveRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  admin: "Full data access, plus inviting and removing Editors/Viewers. Only the Owner can grant Admin or change roles.",
  editor: "Can add, edit, and delete financial data, but can't manage the team.",
  viewer: "Read-only — can see all charts and data, but can't change anything.",
};

export function isAssignableRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (ASSIGNABLE_ROLES as string[]).includes(value);
}

// Owner, admin, and editor can all read/write financial data (items, overrides, settings).
// Only viewers are locked out of mutations.
export function canEditData(role: EffectiveRole): boolean {
  return role !== "viewer";
}

// Only the owner and admins can invite, remove members, or revoke invitations.
export function canManageTeam(role: EffectiveRole): boolean {
  return role === "owner" || role === "admin";
}

// Changing another member's role is owner-only, to prevent an admin from promoting themselves
// or an ally to admin/owner-equivalent access (privilege escalation).
export function canChangeRoles(role: EffectiveRole): boolean {
  return role === "owner";
}

// Governs both invite-time role selection and later role changes. The owner can grant any
// role; an admin can only grant editor/viewer — never admin — so admin-level access can only
// ever be created by the owner, closing the "invite a fresh admin" escalation loophole.
export function canAssignRole(actorRole: EffectiveRole, targetRole: MemberRole): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole !== "admin";
  return false;
}

// Owner can remove anyone (except themselves, handled separately by the caller).
// Admins can remove editors/viewers but not other admins — prevents an admin from unilaterally
// removing peers or the owner.
export function canRemoveMember(actorRole: EffectiveRole, targetRole: EffectiveRole): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole === "editor" || targetRole === "viewer";
  return false;
}
