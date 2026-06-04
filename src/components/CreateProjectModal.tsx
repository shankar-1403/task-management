import { FormEvent, useEffect, useState } from "react";
import { IconFolderPlus } from "@tabler/icons-react";
import type { ProjectCategory, ProjectColor } from "@/types";
import { departmentLabel } from "@/utils/userAccess";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";

const COLORS: ProjectColor[] = [
  "aqua",
  "blue",
  "green",
  "indigo",
  "orange",
  "pink",
  "purple",
  "red",
  "yellow",
];

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, category: ProjectCategory, color: ProjectColor) => Promise<void>;
  /** When set, project is created in this department only (category picker hidden). */
  fixedCategory?: ProjectCategory;
}

export function CreateProjectModal({ onClose, onCreate, fixedCategory }: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProjectCategory>(fixedCategory ?? "technology");
  const [color, setColor] = useState<ProjectColor>("orange");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (fixedCategory) setCategory(fixedCategory);
  }, [fixedCategory]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onCreate(name.trim(), fixedCategory ?? category, color);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title-with-icon">
          <IconFolderPlus size={ICON_SIZE.lg} stroke={ICON_STROKE} className="app-icon app-icon--lg" />
          Create project
        </h2>
        <form onSubmit={handleSubmit}>
          <label className="detail-label" htmlFor="project-name">
            Project name
          </label>
          <input
            id="project-name"
            className="detail-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Marketing launch"
            autoFocus
          />
          <span className="detail-label">Color</span>
          <div className="color-picker">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch project-dot ${c} ${color === c ? "selected" : ""}`}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
          {fixedCategory ? (
            <p className="detail-hint" style={{ marginBottom: 20 }}>
              This project will appear under {departmentLabel(fixedCategory)} projects.
            </p>
          ) : (
            <>
              <label className="detail-label" htmlFor="project-category">
                Category
              </label>
              <select
                id="project-category"
                className="detail-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProjectCategory)}
                style={{ marginBottom: 20 }}
              >
                <option value="technology">Technology</option>
                <option value="marketing">Marketing</option>
              </select>
            </>
          )}
          {error && (
            <div className="auth-error" style={{ marginBottom: 12 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
