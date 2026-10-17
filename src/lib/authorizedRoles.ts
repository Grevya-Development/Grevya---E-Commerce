import { supabase } from "@/lib/supabaseClient";

interface ProfileRoleRecord {
  role?: unknown;
  role_id?: unknown;
}

const normalizeRole = (role: unknown): string | null => {
  if (typeof role !== "string" || !role.trim()) return null;
  const normalized = role.trim().toLowerCase();
  if (normalized === "user") return "customer";
  if (normalized === "super_admin") return "admin";
  return normalized;
};

export async function getAuthorizedUserRoles(
  userId: string,
  profile: ProfileRoleRecord,
): Promise<string[]> {
  const authorizedRoles = new Set<string>();
  const addRole = (role: unknown) => {
    const normalized = normalizeRole(role);
    if (normalized) authorizedRoles.add(normalized);
  };

  addRole(profile.role);

  if (profile.role_id !== undefined && profile.role_id !== null) {
    const profileRoleId = Number(profile.role_id);
    if (!Number.isFinite(profileRoleId)) {
      throw new Error("The account has an invalid role assignment.");
    }

    const { data: profileRole, error: profileRoleError } = await supabase
      .from("roles")
      .select("name")
      .eq("id", profileRoleId)
      .maybeSingle();
    if (profileRoleError) throw profileRoleError;
    addRole(profileRole?.name);
  }

  const { data: assignedRoleRows, error: assignedRolesError } =
    await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", userId);

  if (assignedRolesError) {
    if (authorizedRoles.size === 0) throw assignedRolesError;
    console.warn(
      "[Auth] Could not load additional assigned roles; using the verified profile role.",
      assignedRolesError,
    );
  } else {
    const assignedRoleIds = [
      ...new Set(
        (assignedRoleRows || [])
          .map((roleRow) => Number(roleRow.role_id))
          .filter(Number.isFinite),
      ),
    ];

    if (assignedRoleIds.length > 0) {
      const { data: assignedRoles, error: rolesError } = await supabase
        .from("roles")
        .select("name")
        .in("id", assignedRoleIds);
      if (rolesError) throw rolesError;
      (assignedRoles || []).forEach((role) => addRole(role.name));
    }
  }

  if (authorizedRoles.size === 0) {
    throw new Error(
      "No authorized account role was found. Please contact support.",
    );
  }

  return [...authorizedRoles];
}
