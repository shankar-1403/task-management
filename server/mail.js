import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env",
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });

  return transporter;
}

export async function sendProjectInviteEmail({
  to,
  projectName,
  inviterName,
  appUrl,
  isExistingUser,
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const loginUrl = appUrl;
  const signupUrl = `${appUrl}/?signup=1&email=${encodeURIComponent(to)}`;

  const subject = `You're invited to "${projectName}" on Tasks`;
  const text = isExistingUser
    ? `${inviterName} added you to the project "${projectName}" on Tasks.\n\nOpen the app: ${loginUrl}`
    : `${inviterName} invited you to join "${projectName}" on Tasks.\n\nCreate an account to get started: ${signupUrl}`;

  const html = isExistingUser
    ? `
      <p><strong>${inviterName}</strong> added you to <strong>${projectName}</strong>.</p>
      <p><a href="${loginUrl}">Open Tasks</a> to view the project.</p>
    `
    : `
      <p><strong>${inviterName}</strong> invited you to join <strong>${projectName}</strong>.</p>
      <p><a href="${signupUrl}">Sign up and join the project</a></p>
    `;

  await getTransporter().sendMail({ from, to, subject, text, html });
}
