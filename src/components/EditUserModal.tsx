import { FormEvent, useEffect, useState } from "react";
import { IconPencil } from "@tabler/icons-react";
import type { UserDepartment, UserProfile, UserRole } from "@/types";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";

export interface EditUserFormValues {
  displayName: string;
  role: UserRole;
  department: UserDepartment | null;
  allDepartments: boolean;
}

interface EditUserModalProps {
  user: UserProfile;
  saving: boolean;
  onClose: () => void;
  onSave: (values: EditUserFormValues) => Promise<void>;
}

export function EditUserModal({ user, saving, onClose, onSave }: EditUserModalProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<UserRole>(user.role);
  const [department, setDepartment] = useState<UserDepartment>(user.department ?? "technology");
  const [allDepartments, setAllDepartments] = useState(user.allDepartments);

  useEffect(() => {
    setDisplayName(user.displayName);
    setRole(user.role);
    setDepartment(user.department ?? "technology");
    setAllDepartments(user.allDepartments);
  }, [user]);

  const showDepartmentField = role === "member" || (role === "management" && !allDepartments);
  const showAllDepartmentsToggle = role === "management";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSave({
      displayName: displayName.trim() || user.email.split("@")[0],
      role,
      department: role === "admin" ? null : showDepartmentField ? department : null,
      allDepartments: role === "admin" ? true : role === "management" && allDepartments,
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title-with-icon">
          <IconPencil size={ICON_SIZE.lg} stroke={ICON_STROKE} className="app-icon app-icon--lg" />
          Edit user
        </h2>
        <form onSubmit={handleSubmit}>
          <label className="detail-label">Email</label>
          <input className="detail-input" type="email" value={user.email} disabled readOnly />

          <label className="detail-label" htmlFor="edit-user-name">
            Full name
          </label>
          <input
            id="edit-user-name"
            className="detail-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <label className="detail-label" htmlFor="edit-user-role">
            Role
          </label>
          <select
            id="edit-user-role"
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
              <label className="detail-label" htmlFor="edit-user-department">
                Department
              </label>
              <select
                id="edit-user-department"
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

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
