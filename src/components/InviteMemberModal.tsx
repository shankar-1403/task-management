import { FormEvent, useState } from "react";
import { IconMail } from "@tabler/icons-react";
import { ICON_SIZE, ICON_STROKE } from "@/components/ui/iconProps";

interface InviteMemberModalProps {
  onClose: () => void;
  onInvite: (email: string) => Promise<{ ok: boolean; message: string; emailSent?: boolean }>;
}

export function InviteMemberModal({ onClose, onInvite }: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || saving) return;
    setSaving(true);
    try {
      const result = await onInvite(email.trim());
      setMessage(result.message);
      setIsError(!result.ok);
      // Only auto-close when email actually goes out. Partial success should stay visible.
      if (result.ok && result.emailSent !== false) {
        setEmail("");
        setTimeout(onClose, 800);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send invite.";
      setMessage(msg);
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title-with-icon">
          <IconMail size={ICON_SIZE.lg} stroke={ICON_STROKE} className="app-icon app-icon--lg" />
          Invite teammate
        </h2>
        <p style={{ margin: "0 0 16px", color: "var(--asana-text-muted)", fontSize: 13 }}>
          Send a project invite email. If delivery fails, the invite is still saved and the full error is shown
          here so you can fix EmailJS settings.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="detail-label" htmlFor="invite-email">
            Email address
          </label>
          <input
            id="invite-email"
            type="email"
            className="detail-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            autoFocus
          />
          {message && (
            <p style={{ color: isError ? "var(--asana-accent)" : "var(--asana-success)", fontSize: 13 }}>
              {message}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Sending…" : "Send invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
