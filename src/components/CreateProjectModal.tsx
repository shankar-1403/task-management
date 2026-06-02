import { FormEvent, useState } from "react";
import { IconFolderPlus } from "@tabler/icons-react";
import type { ProjectCategory, ProjectColor } from "@/types";
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
}

export function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProjectCategory>("technology");
  const [color, setColor] = useState<ProjectColor>("orange");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate(name.trim(), category, color);
      onClose();
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
