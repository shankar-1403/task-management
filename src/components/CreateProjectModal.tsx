import { FormEvent, useState } from "react";
import type { ProjectColor } from "@/types";

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
  onCreate: (name: string, color: ProjectColor) => Promise<void>;
}

export function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<ProjectColor>("orange");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate(name.trim(), color);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Create project</h2>
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
