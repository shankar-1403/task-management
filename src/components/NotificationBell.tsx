import { useEffect, useRef, useState } from "react";
import type { AppNotification } from "@/types";
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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeNotifications(user.uid, setNotifications);
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleNotificationClick(notification: AppNotification) {
    if (!user) return;
    if (!notification.read) {
      await markNotificationRead(user.uid, notification.id);
    }
    setOpen(false);
    onOpenTaskAssignment(notification);
  }

  async function handleMarkAllRead() {
    if (!user || unreadCount === 0) return;
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
        <span className="notification-bell-icon" aria-hidden>
          🔔
        </span>
        <span>Inbox</span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <h3>Inbox</h3>
            {unreadCount > 0 && (
              <button type="button" className="btn btn-ghost notification-mark-all" onClick={() => void handleMarkAllRead()}>
                Mark all read
              </button>
            )}
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <p className="notification-empty">Your inbox is empty.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notification-item ${n.read ? "" : "notification-item--unread"}`}
                  onClick={() => void handleNotificationClick(n)}
                >
                  <span className="notification-item-title">
                    {n.fromUserName} assigned you a task
                  </span>
                  <span className="notification-item-body">
                    <strong>{n.taskTitle}</strong> in {n.projectName}
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
