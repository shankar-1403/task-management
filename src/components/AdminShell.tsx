import { IconLogout, IconMenu2, IconUserCog } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";
import solvaDarkLogo from "@/assets/solva_dark_logo.webp";
import solvaLightLogo from "@/assets/solva_light_logo.webp";
import { useTheme } from "@/contexts/ThemeContext";
import { formatUserFooter } from "@/utils/userAccess";

interface AdminShellProps {
  sidebarOpen: boolean;
  isCompactLayout: boolean;
  onToggleSidebar: () => void;
  onCloseSidebar: () => void;
}

const iconProps = { size: ICON_SIZE.md, stroke: ICON_STROKE };

export function AdminShell({
  sidebarOpen,
  isCompactLayout,
  onToggleSidebar,
  onCloseSidebar,
}: AdminShellProps) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  return (
    <div className="app-shell app-shell--admin">
      {isCompactLayout && sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={onCloseSidebar}
        />
      )}
      {sidebarOpen && (
        <aside className="sidebar sidebar--admin-only">
          <div className="sidebar-brand">
            <img
              src={theme === "dark" ? solvaLightLogo : solvaDarkLogo}
              alt="Solva logo"
              className="sidebar-brand-logo-image"
            />
            <button
              type="button"
              className="btn btn-ghost btn-icon sidebar-collapse-btn"
              onClick={onCloseSidebar}
              aria-label="Hide sidebar"
              title="Hide sidebar"
            >
              <IconMenu2 size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
            </button>
          </div>

          <div className="sidebar-section-label">Administration</div>
          <div className="sidebar-nav-item active" aria-current="page">
            <IconUserCog {...iconProps} className="app-icon app-icon--md" />
            <span>Manage users</span>
          </div>

          <div className="sidebar-footer">
            <ThemeToggle className="sidebar-theme-toggle" />
            <div className="user-menu">
              <span className="user-menu-email" title={user?.email}>
                {user ? formatUserFooter(user) : ""}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm sidebar-logout btn-with-icon"
                onClick={() => logout()}
              >
                <IconLogout size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
                Log out
              </button>
            </div>
          </div>
        </aside>
      )}

      <main className={`main-content ${!sidebarOpen ? "main-content--sidebar-hidden" : ""}`}>
        {!sidebarOpen && (
          <button
            type="button"
            className="btn btn-ghost btn-with-icon app-sidebar-toggle"
            aria-label="Open sidebar menu"
            onClick={onToggleSidebar}
          >
            <IconMenu2 size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
          </button>
        )}
        <AdminUsersPage />
      </main>
    </div>
  );
}
