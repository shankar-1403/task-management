import emailjs from "@emailjs/browser";
import type { Project, UserProfile } from "@/types";
import { applyProjectInvite, acceptPendingInvitesForUser } from "@/services/database";

export interface InviteResult {
  ok: boolean;
  message: string;
  emailSent?: boolean;
}

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID ?? "";
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? "";
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? "";

const emailjsConfigured =
  Boolean(EMAILJS_SERVICE_ID) &&
  Boolean(EMAILJS_TEMPLATE_ID) &&
  Boolean(EMAILJS_PUBLIC_KEY);

async function sendInviteEmail(params: {
  to_email: string;
  to_name: string;
  from_name: string;
  project_name: string;
  app_url: string;
  message: string;
}): Promise<InviteResult> {
  if (!emailjsConfigured) {
    return {
      ok: false,
      emailSent: false,
      message:
        "Email not configured. Add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY to .env, then rebuild.",
    };
  }

  try {
    const sendPromise = emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params, {
      publicKey: EMAILJS_PUBLIC_KEY,
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Timed out waiting for EmailJS response")), 15000);
    });
    await Promise.race([sendPromise, timeoutPromise]);
    return { ok: true, emailSent: true, message: `Invitation email sent to ${params.to_email}.` };
  } catch (err) {
    const errorObj = err as { text?: string; status?: number };
    const baseMessage = err instanceof Error ? err.message : "EmailJS send failed.";
    const detail = [errorObj?.status ? `status ${errorObj.status}` : "", errorObj?.text ?? ""]
      .filter(Boolean)
      .join(": ");
    const message = detail ? `${baseMessage} (${detail})` : baseMessage;
    console.error("EmailJS error:", err);
    return { ok: false, emailSent: false, message: `Email failed: ${message}` };
  }
}

export async function sendProjectInvite(
  project: Project,
  email: string,
  inviter: UserProfile,
): Promise<InviteResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const dbResult = await applyProjectInvite(project, normalizedEmail, inviter);
  if (!dbResult.ok) {
    console.error("applyProjectInvite:", dbResult.message);
    return { ok: false, message: dbResult.message };
  }

  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  const signupUrl = `${appUrl}/?signup=1&email=${encodeURIComponent(normalizedEmail)}`;

  const emailResult = await sendInviteEmail({
    to_email: normalizedEmail,
    to_name: normalizedEmail.split("@")[0],
    from_name: inviter.displayName || inviter.email || "A teammate",
    project_name: project.name,
    app_url: dbResult.isExistingUser ? appUrl : signupUrl,
    message: dbResult.isExistingUser
      ? `You have been added to the project "${project.name}". Open the app to see it.`
      : `You are invited to join the project "${project.name}". Click the link to sign up.`,
  });

  if (emailResult.ok) {
    return {
      ok: true,
      emailSent: true,
      message: dbResult.isExistingUser
        ? `${normalizedEmail} was added to the project and notified by email.`
        : `Invitation email sent to ${normalizedEmail}.`,
    };
  }

  if (dbResult.isExistingUser) {
    return {
      ok: true,
      emailSent: false,
      message: `${normalizedEmail} was added to the project. ${emailResult.message}`,
    };
  }

  return {
    ok: true,
    emailSent: false,
    message:
      `Invite saved for ${normalizedEmail}. They should sign up using that exact email. ` +
      emailResult.message,
  };
}

export async function acceptPendingInvites(user: UserProfile): Promise<void> {
  try {
    await acceptPendingInvitesForUser(user);
  } catch (err) {
    console.warn("Could not accept pending invites:", err);
  }
}
