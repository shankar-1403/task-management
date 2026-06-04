import { useEffect, useRef, useState } from "react";
import { IconBell } from "@tabler/icons-react";
import type { AppNotification } from "@/types";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from "@/services/database";
import { useAuth } from "@/contexts/AuthContext";
import { formatTimeAgo } from "@/utils/time";

interface NotificationBellProps {
  onOpenTaskAssignment: (notification: AppNotification) => void;
}

export function NotificationBell({ onOpenTaskAssignment }: NotificationBellProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    setLoadError(null);
    return subscribeNotifications(
      user.uid,
      setNotifications,
      () => setLoadError("Could not load notifications. Check database rules."),
    );
  }, [user]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter((n) => n.read !== true).length;

  async function handleNotificationClick(notification: AppNotification) {
    if (!user) return;
    if (notification.read !== true) {
      await markNotificationRead(user.uid, notification.id);
    }
    setOpen(false);
    onOpenTaskAssignment(notification);
  }

  async function handleMarkAllRead() {
    if (!user || notifications.length === 0) return;
    await markAllNotificationsRead(user.uid);
  }

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Inbox${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
      >
        <IconBell
          size={ICON_SIZE.md}
          stroke={ICON_STROKE}
          className="app-icon app-icon--md notification-bell-icon"
          aria-hidden
        />
        <span>Inbox</span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <h3>Inbox</h3>
            {notifications.length > 0 && (
              <button type="button" className="btn btn-ghost notification-mark-all" onClick={() => void handleMarkAllRead()}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notification-list">
            {loadError ? (
              <p className="notification-empty notification-empty--error">{loadError}</p>
            ) : notifications.length === 0 ? (
              <p className="notification-empty">Your inbox is empty.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notification-item ${n.read === true ? "" : "notification-item--unread"}`}
                  onClick={() => void handleNotificationClick(n)}
                >
                  <span className="notification-item-title">
                    {n.type === "task_priority"
                      ? n.priorityLevel === "urgent"
                        ? "Overdue task needs attention"
                        : "High priority task"
                      : `${n.fromUserName} assigned you a task`}
                  </span>
                  <span className="notification-item-body">
                    <strong>{n.taskTitle}</strong> in {n.projectName}
                    {n.type === "task_priority" && n.fromUserName
                      ? ` · updated by ${n.fromUserName}`
                      : ""}
                  </span>
                  <span className="notification-item-time">{formatTimeAgo(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
