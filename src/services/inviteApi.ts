import { auth } from "@/lib/firebase";

export interface InviteResult {
  ok: boolean;
  message: string;
}

const apiBase = import.meta.env.VITE_API_URL ?? "";

async function authHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function sendProjectInvite(
  projectId: string,
  email: string,
): Promise<InviteResult> {
  try {
    const res = await fetch(`${apiBase}/api/invite`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ projectId, email }),
    });
    const data = (await res.json()) as InviteResult;
    if (!res.ok && data.message) return { ok: false, message: data.message };
    if (!res.ok) return { ok: false, message: "Failed to send invitation." };
    return data;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not reach the invite server.";
    if (message.includes("Failed to fetch")) {
      return {
        ok: false,
        message:
          "Invite server is not running. Start it with: npm run dev:server",
      };
    }
    return { ok: false, message };
  }
}

export async function acceptPendingInvites(): Promise<void> {
  try {
    const res = await fetch(`${apiBase}/api/accept-pending-invites`, {
      method: "POST",
      headers: await authHeaders(),
    });
    if (!res.ok) return;
    await res.json();
  } catch {
    // Non-blocking after login
  }
}
