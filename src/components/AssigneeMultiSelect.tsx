import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown, IconUsers } from "@tabler/icons-react";
import type { AssigneeOption } from "@/types";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import { initials } from "@/utils/avatar";

interface AssigneeMultiSelectProps {
  options: AssigneeOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  compact?: boolean;
  disabled?: boolean;
  loading?: boolean;
  emptyHint?: string;
}

export function AssigneeMultiSelect({
  options,
  selectedIds,
  onChange,
  compact = false,
  disabled = false,
  loading = false,
  emptyHint = "No teammates in your department yet.",
}: AssigneeMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  function updateMenuPosition() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth * 0.9, Math.max(240, rect.width));
    let left = rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setMenuPosition({ top: rect.bottom + 4, left, width });
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
  }, [open, compact, options.length, loading]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleReposition() {
      updateMenuPosition();
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, compact]);

  function toggle(uid: string) {
    if (selectedIds.includes(uid)) {
      onChange(selectedIds.filter((id) => id !== uid));
    } else {
      onChange([...selectedIds, uid]);
    }
  }

  const label =
    selectedIds.length === 0
      ? "Assign"
      : selectedIds.length === 1
        ? options.find((o) => o.uid === selectedIds[0])?.displayName ?? "1 person"
        : `${selectedIds.length} people`;

  function stopBubble(e: { stopPropagation: () => void }) {
    e.stopPropagation();
  }

  const menu =
    open && menuPosition ? (
      <div
        ref={menuRef}
        className="assignee-multi-menu assignee-multi-menu--portal"
        id={listId}
        role="listbox"
        aria-multiselectable
        style={{
          top: menuPosition.top,
          left: menuPosition.left,
          width: menuPosition.width,
        }}
      >
        {loading ? (
          <p className="assignee-multi-empty">Loading teammates…</p>
        ) : options.length === 0 ? (
          <p className="assignee-multi-empty">{emptyHint}</p>
        ) : (
          <>
            {selectedIds.length > 0 && (
              <button
                type="button"
                className="assignee-multi-clear"
                onClick={() => onChange([])}
              >
                Clear all
              </button>
            )}
            {options.map((option) => {
              const checked = selectedIds.includes(option.uid);
              return (
                <label key={option.uid} className="assignee-multi-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option.uid)}
                  />
                  <span className="avatar avatar--sm" title={option.displayName}>
                    {initials(option.displayName)}
                  </span>
                  <span className="assignee-multi-option-text">
                    <span className="assignee-multi-option-name">{option.displayName}</span>
                    <span className="assignee-multi-option-email">{option.email}</span>
                  </span>
                </label>
              );
            })}
          </>
        )}
      </div>
    ) : null;

  return (
    <div
      className={`assignee-multi ${compact ? "assignee-multi--compact" : ""} ${open ? "assignee-multi--open" : ""}`}
      ref={rootRef}
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
    >
      <button
        ref={triggerRef}
        type="button"
        className="assignee-multi-trigger"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || loading}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
      >
        <IconUsers size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
        <span className="assignee-multi-label">{loading ? "Loading…" : label}</span>
        <IconChevronDown size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
      </button>

      {menu && createPortal(menu, document.body)}

      {!compact && selectedIds.length > 0 && (
        <div className="assignee-multi-pills">
          {selectedIds.map((id) => {
            const person = options.find((o) => o.uid === id);
            if (!person) return null;
            return (
              <span key={id} className="assignee-pill has-assignee">
                <span className="avatar avatar--sm">{initials(person.displayName)}</span>
                {person.displayName}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
