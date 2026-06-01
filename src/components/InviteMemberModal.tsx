import { FormEvent, useState } from "react";

interface InviteMemberModalProps {
  onClose: () => void;
  onInvite: (email: string) => Promise<{ ok: boolean; message: string }>;
}

export function InviteMemberModal({ onClose, onInvite }: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    const result = await onInvite(email.trim());
    setMessage(result.message);
    setIsError(!result.ok);
    setSaving(false);
    if (result.ok) {
      setEmail("");
      setTimeout(onClose, 800);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Invite teammate</h2>
        <p style={{ margin: "0 0 16px", color: "var(--asana-text-muted)", fontSize: 13 }}>
          An invitation email will be sent. New users can sign up from the link in the email.
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
