import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "@/contexts/ThemeContext";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = "", showLabel = true }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span className="theme-toggle-track" aria-hidden>
        <span className={`theme-toggle-thumb ${isDark ? "theme-toggle-thumb--dark" : ""}`}>
          {isDark ? (
            <IconMoon size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
          ) : (
            <IconSun size={ICON_SIZE.sm} stroke={ICON_STROKE} className="app-icon app-icon--sm" />
          )}
        </span>
      </span>
      {showLabel && <span className="theme-toggle-label">{isDark ? "Dark" : "Light"}</span>}
    </button>
  );
}
