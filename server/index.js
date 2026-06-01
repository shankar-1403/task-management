import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, verifyIdToken, initFirebaseAdmin } from "./firebase.js";
import { sendProjectInviteEmail } from "./mail.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const app = express();
const port = Number(process.env.API_PORT || 3001);
const appUrl = process.env.APP_URL || "http://localhost:5173";

app.use(
  cors({
    origin: [appUrl, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  }),
);
app.use(express.json());

function emailKey(email) {
  return email.toLowerCase().replace(/\./g, ",");
}

function memberIdsToArray(memberIds) {
  if (!memberIds) return [];
  if (Array.isArray(memberIds)) return memberIds;
  return Object.keys(memberIds);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/invite", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, message: "Not authenticated." });
    }

    const idToken = authHeader.slice(7);
    const decoded = await verifyIdToken(idToken);
    const { projectId, email } = req.body ?? {};

    if (!projectId || !email) {
      return res.status(400).json({ ok: false, message: "Project and email are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ ok: false, message: "Invalid email address." });
    }

    const db = getDb();
    const projectSnap = await db.ref(`projects/${projectId}`).get();
    if (!projectSnap.exists()) {
      return res.json({ ok: false, message: "Project not found." });
    }

    const project = projectSnap.val();
    const memberIds = memberIdsToArray(project.memberIds);

    if (!memberIds.includes(decoded.uid)) {
      return res.status(403).json({ ok: false, message: "You are not a member of this project." });
    }

    const inviterSnap = await db.ref(`users/${decoded.uid}`).get();
    const inviterName = inviterSnap.val()?.displayName || decoded.email || "A teammate";

    const key = emailKey(normalizedEmail);
    const existingUserSnap = await db.ref(`usersByEmail/${key}`).get();

    if (existingUserSnap.exists()) {
      const memberUid = existingUserSnap.val();
      if (memberIds.includes(memberUid)) {
        return res.json({ ok: false, message: "This user is already on the project." });
      }

      await db.ref(`projects/${projectId}/memberIds/${memberUid}`).set(true);
      await db.ref(`userProjects/${memberUid}/${projectId}`).set(true);
      await db.ref(`pendingInvites/${key}/${projectId}`).remove();

      await sendProjectInviteEmail({
        to: normalizedEmail,
        projectName: project.name,
        inviterName,
        appUrl,
        isExistingUser: true,
      });

      return res.json({
        ok: true,
        message: `Invitation email sent to ${normalizedEmail}. They can access the project now.`,
      });
    }

    await db.ref(`pendingInvites/${key}/${projectId}`).set({
      email: normalizedEmail,
      projectName: project.name,
      invitedBy: decoded.uid,
      invitedAt: Date.now(),
    });

    await sendProjectInviteEmail({
      to: normalizedEmail,
      projectName: project.name,
      inviterName,
      appUrl,
      isExistingUser: false,
    });

    return res.json({
      ok: true,
      message: `Invitation email sent to ${normalizedEmail}.`,
    });
  } catch (err) {
    console.error("Invite error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to send invitation.";
    return res.status(500).json({ ok: false, message });
  }
});

app.post("/api/accept-pending-invites", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, message: "Not authenticated." });
    }

    const decoded = await verifyIdToken(authHeader.slice(7));
    const userSnap = await getDb().ref(`users/${decoded.uid}`).get();
    if (!userSnap.exists()) {
      return res.json({ ok: true, accepted: 0 });
    }

    const email = userSnap.val().email;
    if (!email) return res.json({ ok: true, accepted: 0 });

    const key = emailKey(email);
    const pendingSnap = await getDb().ref(`pendingInvites/${key}`).get();
    if (!pendingSnap.exists()) {
      return res.json({ ok: true, accepted: 0 });
    }

    const pending = pendingSnap.val();
    let accepted = 0;

    for (const [projectId] of Object.entries(pending)) {
      await getDb().ref(`projects/${projectId}/memberIds/${decoded.uid}`).set(true);
      await getDb().ref(`userProjects/${decoded.uid}/${projectId}`).set(true);
      accepted++;
    }

    await getDb().ref(`pendingInvites/${key}`).remove();

    return res.json({ ok: true, accepted });
  } catch (err) {
    console.error("Accept invites error:", err);
    return res.status(500).json({ ok: false, message: "Failed to accept invitations." });
  }
});

try {
  initFirebaseAdmin();
  app.listen(port, () => {
    console.log(`Invite API running on http://localhost:${port}`);
  });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
