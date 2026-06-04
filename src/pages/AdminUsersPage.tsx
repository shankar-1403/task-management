import { FormEvent, useEffect, useState } from "react";
import { IconPencil, IconTrash, IconUserPlus } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { EditUserModal, type EditUserFormValues } from "@/components/EditUserModal";
import {
  emailAlreadyRegistered,
  listAllUsers,
  rebuildDepartmentProjectIndexes,
  rebuildDepartmentUserIndexes,
} from "@/services/userAdmin";
import type { UserDepartment, UserProfile, UserRole } from "@/types";
import { formatUserDepartment, isAdmin, roleLabel } from "@/utils/userAccess";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";

export function AdminUsersPage() {
  const { user: currentAdmin, createUser, updateUser, deleteUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState<UserDepartment>("technology");
  const [role, setRole] = useState<UserRole>("member");
  const [allDepartments, setAllDepartments] = useState(false);

  const showDepartmentField = role === "member" || (role === "management" && !allDepartments);
  const showAllDepartmentsToggle = role === "management";

  async function refreshUsers() {
    setLoading(true);
    setError("");
    try {
      const list = await listAllUsers();
      setUsers(list);
      void rebuildDepartmentUserIndexes(list).catch((err) => {
        console.warn("Department user index rebuild failed:", err);
      });
      void rebuildDepartmentProjectIndexes().catch((err) => {
        console.warn("Department project index rebuild failed:", err);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load users.";
      setError(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshUsers();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const normalized = email.trim().toLowerCase();
      if (await emailAlreadyRegistered(normalized)) {
        throw new Error("A user with this email already exists.");
      }
      const profile = await createUser({
        email: normalized,
        password,
        displayName: displayName.trim() || normalized.split("@")[0],
        role,
        department: role === "admin" ? null : showDepartmentField ? department : null,
        allDepartments: role === "admin" ? true : role === "management" && allDepartments,
      });
      setSuccess(`Created account for ${profile.displayName} (${profile.email}).`);
      setEmail("");
      setDisplayName("");
      setPassword("");
      setDepartment("technology");
      setRole("member");
      setAllDepartments(false);
      await refreshUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(values: EditUserFormValues) {
    if (!editingUser) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const updated = await updateUser({
        uid: editingUser.uid,
        displayName: values.displayName,
        role: values.role,
        department: values.department,
        allDepartments: values.allDepartments,
      });
      setSuccess(`Updated ${updated.displayName}.`);
      setEditingUser(null);
      await refreshUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(target: UserProfile) {
    const confirmed = window.confirm(
      `Delete "${target.displayName}" (${target.email})?\n\nThey will no longer be able to sign in. Remove their Firebase Authentication account separately in Firebase Console if needed.`,
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await deleteUser(target);
      setSuccess(`Deleted ${target.displayName}.`);
      if (editingUser?.uid === target.uid) {
        setEditingUser(null);
      }
      await refreshUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete user.");
    } finally {
      setSaving(false);
    }
  }

  const isSelf = (uid: string) => currentAdmin?.uid === uid;

  return (
    <div className="page admin-users-page">
      <header className="page-header">
        <h1>Manage users</h1>
        <p>
          Create, edit, and remove accounts. Administrators have no department. Management can be
          granted both Technology and Marketing.
        </p>
      </header>

      {currentAdmin && !isAdmin(currentAdmin) && (
        <div className="auth-error" style={{ marginBottom: 16 }}>
          Your account is not an administrator. In Firebase Realtime Database set{" "}
          <code>users/{currentAdmin.uid}/role</code> to <code>admin</code> and{" "}
          <code>config/adminUids/{currentAdmin.uid}</code> to <code>true</code>, deploy rules, then
          sign out and back in.
        </div>
      )}

      {currentAdmin && isAdmin(currentAdmin) && error.includes("permission denied") && (
        <div className="auth-error" style={{ marginBottom: 16 }}>
          Admin bootstrap: in Firebase Console → Realtime Database, add{" "}
          <code>config/adminUids/{currentAdmin.uid}</code> = <code>true</code> (and confirm{" "}
          <code>users/{currentAdmin.uid}/role</code> is <code>admin</code>), then run{" "}
          <code>firebase deploy --only database</code> and sign in again.
        </div>
      )}

      {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && (
        <div className="auth-success" style={{ marginBottom: 16 }}>
          {success}
        </div>
      )}

      <section className="admin-users-form-card">
        <h2 className="modal-title-with-icon">
          <IconUserPlus size={ICON_SIZE.lg} stroke={ICON_STROKE} className="app-icon app-icon--lg" />
          Create user
        </h2>
        <form onSubmit={handleCreate}>
          <label className="detail-label" htmlFor="admin-user-name">
            Full name
          </label>
          <input
            id="admin-user-name"
            className="detail-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane Cooper"
          />
          <label className="detail-label" htmlFor="admin-user-email">
            Email
          </label>
          <input
            id="admin-user-email"
            className="detail-input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
          />
          <label className="detail-label" htmlFor="admin-user-password">
            Temporary password
          </label>
          <input
            id="admin-user-password"
            className="detail-input"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          <label className="detail-label" htmlFor="admin-user-role">
            Role
          </label>
          <select
            id="admin-user-role"
            className="detail-select"
            value={role}
            onChange={(e) => {
              const next = e.target.value as UserRole;
              setRole(next);
              if (next === "admin") {
                setAllDepartments(false);
              } else if (next === "management") {
                setAllDepartments(true);
              } else {
                setAllDepartments(false);
              }
            }}
          >
            <option value="member">Member (one department)</option>
            <option value="management">Management</option>
            <option value="admin">Administrator (no department)</option>
          </select>

          {showAllDepartmentsToggle && (
            <label className="admin-checkbox-row" style={{ marginTop: 12, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={allDepartments}
                onChange={(e) => setAllDepartments(e.target.checked)}
              />
              <span>Access both Technology and Marketing projects</span>
            </label>
          )}

          {showDepartmentField && (
            <>
              <label className="detail-label" htmlFor="admin-user-department">
                Department
              </label>
              <select
                id="admin-user-department"
                className="detail-select"
                value={department}
                onChange={(e) => setDepartment(e.target.value as UserDepartment)}
                style={{ marginBottom: 20 }}
              >
                <option value="technology">Technology</option>
                <option value="marketing">Marketing</option>
              </select>
            </>
          )}

          {role === "admin" && (
            <p className="detail-hint" style={{ marginBottom: 20 }}>
              Administrators are not tied to a department and only manage users.
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={role === "admin" ? undefined : { marginTop: 0 }}
          >
            {saving ? "Creating…" : "Create user"}
          </button>
        </form>
      </section>

      <section className="admin-users-list">
        <h2>All users</h2>
        {loading ? (
          <p>Loading users…</p>
        ) : users.length === 0 ? (
          <p className="empty-state">No users yet.</p>
        ) : (
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
                <th className="admin-users-table-actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid}>
                  <td>{u.displayName}</td>
                  <td>{u.email}</td>
                  <td>{formatUserDepartment(u)}</td>
                  <td>{roleLabel(u.role)}</td>
                  <td className="admin-users-table-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-with-icon"
                      onClick={() => setEditingUser(u)}
                      disabled={saving}
                      title="Edit user"
                    >
                      <IconPencil size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-with-icon admin-btn-danger"
                      onClick={() => void handleDelete(u)}
                      disabled={saving || isSelf(u.uid)}
                      title={isSelf(u.uid) ? "You cannot delete yourself" : "Delete user"}
                    >
                      <IconTrash size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          saving={saving}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
