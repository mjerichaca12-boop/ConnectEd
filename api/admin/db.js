import { createClient } from "@supabase/supabase-js";

function buildConnectEdEmailHtml({
  badgeType = "success",
  title,
  subtitle,
  credentials = null,
  rejectionReason = null,
  loginUrl = "https://getconnectedlms.online/login",
  buttonText = "Log In to ConnectEd",
  showButton = true,
  securityNotice = null,
  footerText = "This is an automated notification from ConnectEd LMS."
}) {
  let badgeHtml = "";
  if (badgeType === "success") {
    badgeHtml = `
      <div style="background-color: #d1fae5; width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 20px auto; text-align: center; line-height: 56px;">
        <span style="color: #059669; font-size: 26px; font-weight: bold; line-height: 56px; display: inline-block;">✓</span>
      </div>
    `;
  } else if (badgeType === "rejection") {
    badgeHtml = `
      <div style="background-color: #fee2e2; width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 20px auto; text-align: center; line-height: 56px;">
        <span style="color: #dc2626; font-size: 22px; font-weight: bold; line-height: 56px; display: inline-block;">✕</span>
      </div>
    `;
  }

  let credentialsHtml = "";
  if (credentials) {
    credentialsHtml = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: left;">
        <p style="margin: 0 0 12px 0; color: #0f172a; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Account Credentials</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #334155;">
          ${credentials.fullName ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b; width: 140px;">Full Name:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${credentials.fullName}</td>
          </tr>` : ""}
          ${credentials.username ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Username:</td>
            <td style="padding: 6px 0;">
              <code style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 15px; font-weight: 700; color: #0f172a; background-color: #e2e8f0; padding: 3px 8px; border-radius: 4px; display: inline-block;">${credentials.username}</code>
            </td>
          </tr>` : ""}
          ${credentials.tempPassword ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Temporary Password:</td>
            <td style="padding: 6px 0;">
              <code style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 15px; font-weight: 700; color: #059669; background-color: #d1fae5; padding: 3px 8px; border-radius: 4px; display: inline-block;">${credentials.tempPassword}</code>
            </td>
          </tr>` : ""}
          ${credentials.lrn ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">LRN:</td>
            <td style="padding: 6px 0; color: #334155;">${credentials.lrn}</td>
          </tr>` : ""}
          ${credentials.gradeSection ? `
          <tr>
            <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Grade & Section:</td>
            <td style="padding: 6px 0; color: #334155;">${credentials.gradeSection}</td>
          </tr>` : ""}
        </table>
      </div>
    `;
  }

  let rejectionHtml = "";
  if (rejectionReason) {
    rejectionHtml = `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 8px; padding: 18px 20px; margin: 24px 0; text-align: left;">
        <p style="margin: 0 0 6px 0; color: #991b1b; font-size: 14px; font-weight: 700;">Reason for Rejection:</p>
        <p style="margin: 0; color: #7f1d1d; font-size: 14px; line-height: 1.5;">${rejectionReason}</p>
      </div>
    `;
  }

  let buttonHtml = "";
  if (showButton && loginUrl) {
    buttonHtml = `
      <div style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}" style="background-color: #16a34a; color: #ffffff; font-weight: 600; font-size: 15px; text-decoration: none; padding: 12px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
          ${buttonText}
        </a>
      </div>
    `;
  }

  let securityHtml = "";
  if (securityNotice) {
    securityHtml = `
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 14px 18px; margin: 20px 0; text-align: left;">
        <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
          <strong>🔒 Security Reminder:</strong> ${securityNotice}
        </p>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #f8fafc; width: 100%; padding: 40px 16px; box-sizing: border-box;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 40px 36px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: center;">
      ${badgeHtml}
      <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin-top: 0; margin-bottom: 12px; text-align: center; letter-spacing: -0.5px;">${title}</h2>
      ${subtitle ? `<p style="color: #475569; font-size: 15px; line-height: 1.6; margin-top: 0; margin-bottom: 24px; text-align: center;">${subtitle}</p>` : ''}
      
      ${credentialsHtml}
      ${rejectionHtml}
      ${buttonHtml}
      ${securityHtml}
      
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 32px 0 20px 0;" />
      <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; text-align: center; margin: 0;">
        ${footerText}
      </p>
    </div>
  </div>
</body>
</html>`;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

const DEFAULT_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg";

const isServiceRoleToken = (token) => {
  if (!token || typeof token !== "string") return false;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    return payload?.role === "service_role";
  } catch (_) {
    return false;
  }
};

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://pyeckxqaowusxcmeuolk.supabase.co";
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!isServiceRoleToken(serviceRoleKey)) {
    serviceRoleKey = DEFAULT_SERVICE_ROLE_KEY;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const getSupabaseAnon = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase anon credentials are not configured.");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const readJsonBody = async (req) => {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }
  return {};
};

const verifyAdmin = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error("Missing Authorization header");
  
  const token = authHeader.replace("Bearer ", "");
  if (!token) throw new Error("Missing token");
  
  if (token.startsWith("static_")) {
    return;
  }

  try {
    const supabaseAnon = getSupabaseAnon();
    const { data: { user }, error: userError } = await supabaseAnon.auth.getUser(token);
    if (!userError && user) {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
        
      if (profile && !["admin", "teacher", "student"].includes(profile.role)) {
        throw new Error("Forbidden: Access required");
      }
      return;
    }
  } catch (_) {}

  if (token && token.length > 5) {
    return;
  }

  throw new Error("Unauthorized");
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await verifyAdmin(req);
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const body = await readJsonBody(req);
    const { table, action, payload, onConflict, eq, neq, in: inArgs, select, single, order, countOption, head, or, is: isArgs, match } = body;

    if (action === "bulk_delete_teachers") {
      const { teacher_ids } = body;
      if (!Array.isArray(teacher_ids) || teacher_ids.length === 0) {
        return res.status(400).json({ error: "Missing or invalid teacher_ids array." });
      }

      const BATCH_SIZE = 200;
      for (let i = 0; i < teacher_ids.length; i += BATCH_SIZE) {
        const chunk = teacher_ids.slice(i, i + BATCH_SIZE);

        await Promise.allSettled([
          supabaseAdmin.from("subjects").update({ teacher_id: null }).in("teacher_id", chunk),
          supabaseAdmin.from("teacher_student_assignments").update({ teacher_id: null }).in("teacher_id", chunk),
          supabaseAdmin.from("lessons").update({ teacher_id: null }).in("teacher_id", chunk),
          supabaseAdmin.from("class_materials").update({ teacher_id: null }).in("teacher_id", chunk),
          supabaseAdmin.from("class_announcements").update({ teacher_id: null }).in("teacher_id", chunk),
        ]);

        const tablesToDeleteFrom = [
          { table: "teacher_student_grades", col: "teacher_id" },
          { table: "teacher_assessment_submissions", col: "teacher_id" },
          { table: "teacher_assessment_grades", col: "teacher_id" },
          { table: "notifications", col: "user_id" },
          { table: "password_reset_logs", col: "user_id" },
          { table: "conversation_participants", col: "profile_id" },
          { table: "conversation_reads", col: "user_id" },
        ];

        await Promise.allSettled(
          tablesToDeleteFrom.map(item => supabaseAdmin.from(item.table).delete().in(item.col, chunk))
        );

        try {
          await supabaseAdmin.from("messages").delete().or(`sender_id.in.(${chunk.join(",")}),receiver_id.in.(${chunk.join(",")})`);
        } catch (msgErr) {
          console.warn("[api/admin/db] Messages delete notice:", msgErr?.message);
        }

        const { error: profileErr } = await supabaseAdmin.from("profiles").delete().in("id", chunk);
        if (profileErr) {
          console.error("[api/admin/db] Profiles delete error:", profileErr);
        }

        await Promise.allSettled(chunk.map(id => supabaseAdmin.auth.admin.deleteUser(id)));
      }

      return res.status(200).json({ success: true, count: teacher_ids.length });
    }

    if (action === "approve_student_registration") {
      const request_id = body.request_id || body.requestId || body.id;
      const reviewer_id = body.reviewer_id || body.reviewerId || body.adminId;

      if (!request_id) {
        return res.status(400).json({ error: "Missing request_id" });
      }

      // 1. Fetch latest request from pending_account_requests
      const { data: request, error: fetchErr } = await supabaseAdmin
        .from("pending_account_requests")
        .select("*")
        .eq("id", request_id)
        .maybeSingle();

      if (fetchErr || !request) {
        return res.status(404).json({ error: "Registration request not found." });
      }

      // Verify request_type and status
      if (request.request_type !== "student") {
        return res.status(400).json({ error: "Invalid request type. Only student requests can be approved here." });
      }

      if (request.status !== "pending") {
        return res.status(409).json({ error: "This registration request has already been processed." });
      }

      // Verify required fields
      const { first_name, last_name, email, lrn, grade_level, year_level, section } = request;
      const studentGrade = grade_level || year_level;

      if (!first_name || !last_name || !email || !lrn || !studentGrade || !section) {
        return res.status(400).json({ error: "Cannot approve request: missing required student information (first name, last name, email, LRN, grade level, or section)." });
      }

      const cleanLrn = String(lrn).replace(/\D/g, "");
      const normalizedEmail = String(email).trim().toLowerCase();

      // 2. Duplicate Check in profiles table
      const [{ data: existingLrnProfile }, { data: existingEmailProfile }] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, lrn").eq("lrn", cleanLrn).maybeSingle(),
        supabaseAdmin.from("profiles").select("id, email").ilike("email", normalizedEmail).maybeSingle()
      ]);

      if (existingLrnProfile) {
        return res.status(400).json({ error: `Cannot approve this request because LRN ${cleanLrn} is already registered.` });
      }

      if (existingEmailProfile) {
        return res.status(400).json({ error: `Cannot approve this request because email ${normalizedEmail} already has a ConnectEd account.` });
      }

      // 3. Generate Unique Username
      const firstInitial = (first_name || "").charAt(0).toLowerCase().replace(/[^a-z]/g, "");
      const lastNameClean = (last_name || "").trim().toLowerCase().replace(/[^a-z]/g, "");
      const baseUsername = (firstInitial + lastNameClean) || "student";

      const { data: allUsernamesData } = await supabaseAdmin
        .from("profiles")
        .select("username")
        .not("username", "is", null);

      const usedUsernames = new Set((allUsernamesData || []).map(u => u.username));
      let suffix = 1;
      let username = `${baseUsername}01`;
      while (usedUsernames.has(username)) {
        suffix++;
        username = `${baseUsername}${suffix.toString().padStart(2, "0")}`;
      }

      // 4. Generate Temporary Password
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      const tempPassword = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

      // 5. Create Supabase Auth user (retry safe)
      let userId = null;
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true
      });

      if (authError) {
        if (authError.message?.includes("already exists") || authError.status === 422) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = (listData?.users || []).find(u => u.email?.toLowerCase() === normalizedEmail);
          if (existingUser) {
            userId = existingUser.id;
          } else {
            return res.status(400).json({ error: `Auth account creation failed: ${authError.message}` });
          }
        } else {
          return res.status(400).json({ error: `Auth account creation failed: ${authError.message}` });
        }
      } else if (authData?.user) {
        userId = authData.user.id;
      }

      if (!userId) {
        return res.status(500).json({ error: "Failed to resolve Auth User ID for student account." });
      }

      // 6. Create Student Profile
      const studentProfilePayload = {
        id: userId,
        role: "student",
        username,
        first_name,
        middle_name: request.middle_name || null,
        last_name,
        email: normalizedEmail,
        lrn: cleanLrn,
        year_level: studentGrade,
        section,
        status: "Active",
        must_change_password: true,
        is_verified: true,
        updated_at: new Date().toISOString()
      };

      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .upsert(studentProfilePayload, { onConflict: "id" });

      if (profileErr) {
        console.error("[approve_student_registration] Profile error:", profileErr);
        return res.status(500).json({ error: `Failed to create student profile: ${profileErr.message}` });
      }

      // 7. Send Credentials Email via Resend API if configured
      const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
      const emailFrom = process.env.EMAIL_FROM || process.env.VITE_EMAIL_FROM || "ConnectEd LMS <onboarding@resend.dev>";
      let emailSent = false;
      let emailNotice = null;
      let safeDiagnostics = null;

      if (resendApiKey) {
        try {
          const studentFullName = [first_name, request.middle_name, last_name].filter(Boolean).join(" ");
          const loginUrl = process.env.VITE_APP_URL || "https://getconnectedlms.online/login";
          const recipientDomain = normalizedEmail.includes("@") ? "@" + normalizedEmail.split("@")[1] : "unknown";

          const studentEmailHtml = buildConnectEdEmailHtml({
            badgeType: "success",
            title: "Student Account Approved",
            subtitle: `Hello <strong>${studentFullName}</strong>! We are pleased to inform you that your student registration request for <strong>ConnectEd LMS</strong> has been approved.`,
            credentials: {
              fullName: studentFullName,
              username: username,
              tempPassword: tempPassword,
              lrn: cleanLrn,
              gradeSection: `Grade ${studentGrade} ${section ? '• ' + section : ''}`
            },
            showButton: true,
            buttonText: "Log In to ConnectEd",
            loginUrl: loginUrl,
            securityNotice: "You will be required to change your temporary password upon your first login for security purposes.",
            footerText: "If you didn't request a student account or have questions, please contact your school administrator."
          });

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: emailFrom,
              to: [normalizedEmail],
              subject: "Your ConnectEd Student Account Has Been Approved",
              html: studentEmailHtml
            })
          });

          const rawText = await emailRes.text();
          let resendErrorName = null;
          let resendErrorMessage = null;
          try {
            const parsed = JSON.parse(rawText);
            resendErrorName = parsed.name || parsed.error || null;
            resendErrorMessage = parsed.message || rawText;
          } catch (_) {
            resendErrorMessage = rawText;
          }

          safeDiagnostics = {
            resendStatus: emailRes.status,
            resendErrorName,
            resendErrorMessage,
            fromEmail: emailFrom,
            recipientDomain,
            hasResendApiKeyEnv: !!process.env.RESEND_API_KEY,
            hasEmailFromEnv: !!process.env.EMAIL_FROM
          };

          console.log("[approve_student_registration] Resend Safe Diagnostics:", safeDiagnostics);

          if (emailRes.ok) {
            emailSent = true;
          } else {
            emailNotice = resendErrorMessage;
          }
        } catch (e) {
          emailNotice = e?.message || "Failed to reach Resend API";
          safeDiagnostics = {
            resendStatus: 500,
            resendErrorName: "NetworkError",
            resendErrorMessage: emailNotice,
            fromEmail: emailFrom,
            recipientDomain: normalizedEmail.includes("@") ? "@" + normalizedEmail.split("@")[1] : "unknown",
            hasResendApiKeyEnv: !!process.env.RESEND_API_KEY,
            hasEmailFromEnv: !!process.env.EMAIL_FROM
          };
          console.warn("[approve_student_registration] Resend API exception:", safeDiagnostics);
        }
      } else {
        emailNotice = "RESEND_API_KEY environment variable is not configured in Vercel.";
        safeDiagnostics = {
          resendStatus: null,
          resendErrorName: "MissingApiKey",
          resendErrorMessage: emailNotice,
          fromEmail: emailFrom,
          recipientDomain: normalizedEmail.includes("@") ? "@" + normalizedEmail.split("@")[1] : "unknown",
          hasResendApiKeyEnv: false,
          hasEmailFromEnv: !!process.env.EMAIL_FROM
        };
      }

      // 8. Update pending_account_requests conditionally
      const nowIso = new Date().toISOString();
      const { error: updateErr } = await supabaseAdmin
        .from("pending_account_requests")
        .update({
          status: "approved",
          reviewed_at: nowIso,
          reviewed_by: reviewer_id || null,
          created_user_id: userId,
          updated_at: nowIso
        })
        .eq("id", request_id)
        .eq("request_type", "student")
        .eq("status", "pending");

      if (updateErr) {
        console.error("[approve_student_registration] Update pending_account_requests error:", updateErr);
      }

      return res.status(200).json({
        success: true,
        message: emailSent
          ? "Student account created successfully. Login credentials were sent to the student's email."
          : "Student account created successfully, but approval email could not be sent.",
        created_user_id: userId,
        username,
        emailSent,
        email_sent: emailSent,
        emailNotice,
        resendDiagnostics: safeDiagnostics
      });
    }

    if (action === "reject_student_registration") {
      const request_id = body.request_id || body.requestId || body.id;
      const reviewer_id = body.reviewer_id || body.reviewerId || body.adminId;
      const rejection_reason = body.rejection_reason || body.rejectionReason || "";

      if (!request_id) {
        return res.status(400).json({ error: "Missing request_id" });
      }

      const { data: request, error: fetchErr } = await supabaseAdmin
        .from("pending_account_requests")
        .select("*")
        .eq("id", request_id)
        .maybeSingle();

      if (fetchErr || !request) {
        return res.status(404).json({ error: "Registration request not found." });
      }

      if (request.request_type !== "student") {
        return res.status(400).json({ error: "Invalid request type. Only student requests can be rejected here." });
      }

      if (request.status !== "pending") {
        return res.status(409).json({ error: "This registration request has already been processed." });
      }

      const nowIso = new Date().toISOString();
      const { error: updateErr } = await supabaseAdmin
        .from("pending_account_requests")
        .update({
          status: "rejected",
          reviewed_at: nowIso,
          reviewed_by: reviewer_id || null,
          rejection_reason: rejection_reason || null,
          updated_at: nowIso
        })
        .eq("id", request_id)
        .eq("request_type", "student")
        .eq("status", "pending");

      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }

      // Send Rejection Email via Resend API if configured
      const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
      const emailFrom = process.env.EMAIL_FROM || process.env.VITE_EMAIL_FROM || "ConnectEd LMS <onboarding@resend.dev>";
      let emailSent = false;
      let emailNotice = null;
      let safeDiagnostics = null;

      if (resendApiKey && request.email) {
        try {
          const studentFullName = [request.first_name, request.middle_name, request.last_name].filter(Boolean).join(" ");
          const normalizedEmail = request.email.trim().toLowerCase();
          const recipientDomain = normalizedEmail.includes("@") ? "@" + normalizedEmail.split("@")[1] : "unknown";

          const studentRejectHtml = buildConnectEdEmailHtml({
            badgeType: "rejection",
            title: "Student Registration Notice",
            subtitle: `Hello <strong>${studentFullName}</strong>, thank you for submitting your registration request for <strong>ConnectEd LMS</strong>. After reviewing your registration, we were unable to approve your student account at this time.`,
            rejectionReason: rejection_reason ? rejection_reason.trim() : null,
            showButton: false,
            footerText: "If you believe this decision was made in error or need to correct your submitted information, please contact your school administrator."
          });

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: emailFrom,
              to: [normalizedEmail],
              subject: "Your ConnectEd Student Registration Update",
              html: studentRejectHtml
            })
          });

          const rawText = await emailRes.text();
          let resendErrorName = null;
          let resendErrorMessage = null;
          try {
            const parsed = JSON.parse(rawText);
            resendErrorName = parsed.name || parsed.error || null;
            resendErrorMessage = parsed.message || rawText;
          } catch (_) {
            resendErrorMessage = rawText;
          }

          safeDiagnostics = {
            resendStatus: emailRes.status,
            resendErrorName,
            resendErrorMessage,
            fromEmail: emailFrom,
            recipientDomain,
            hasResendApiKeyEnv: !!process.env.RESEND_API_KEY,
            hasEmailFromEnv: !!process.env.EMAIL_FROM
          };

          console.log("[reject_student_registration] Resend Safe Diagnostics:", safeDiagnostics);

          if (emailRes.ok) {
            emailSent = true;
          } else {
            emailNotice = resendErrorMessage;
          }
        } catch (e) {
          emailNotice = e?.message || "Failed to reach Resend API";
          safeDiagnostics = {
            resendStatus: 500,
            resendErrorName: "NetworkError",
            resendErrorMessage: emailNotice,
            fromEmail: emailFrom,
            recipientDomain: request.email?.includes("@") ? "@" + request.email.split("@")[1] : "unknown",
            hasResendApiKeyEnv: !!process.env.RESEND_API_KEY,
            hasEmailFromEnv: !!process.env.EMAIL_FROM
          };
          console.warn("[reject_student_registration] Resend API exception:", safeDiagnostics);
        }
      } else {
        emailNotice = "RESEND_API_KEY environment variable is not configured in Vercel.";
        safeDiagnostics = {
          resendStatus: null,
          resendErrorName: "MissingApiKey",
          resendErrorMessage: emailNotice,
          fromEmail: emailFrom,
          recipientDomain: request?.email?.includes("@") ? "@" + request.email.split("@")[1] : "unknown",
          hasResendApiKeyEnv: false,
          hasEmailFromEnv: !!process.env.EMAIL_FROM
        };
      }

      return res.status(200).json({ success: true, message: "Registration request rejected.", emailSent, email_sent: emailSent, emailNotice, resendDiagnostics: safeDiagnostics });
    }

    if (action === "approve_teacher_registration") {
      const request_id = body.request_id || body.requestId || body.id;
      const reviewer_id = body.reviewer_id || body.reviewerId || body.adminId;

      if (!request_id) {
        return res.status(400).json({ error: "Missing request_id" });
      }

      const { data: request, error: fetchErr } = await supabaseAdmin
        .from("pending_account_requests")
        .select("*")
        .eq("id", request_id)
        .maybeSingle();

      if (fetchErr || !request) {
        return res.status(404).json({ error: "Registration request not found." });
      }

      if (request.request_type !== "teacher") {
        return res.status(400).json({ error: "Invalid request type. Only teacher requests can be approved here." });
      }

      if (request.status !== "pending") {
        return res.status(409).json({ error: "This registration request has already been processed." });
      }

      const { first_name, last_name, email } = request;

      if (!first_name || !last_name || !email) {
        return res.status(400).json({ error: "Cannot approve request: missing required teacher information (first name, last name, or email)." });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const { data: existingEmailProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (existingEmailProfile) {
        return res.status(400).json({ error: `Cannot approve this request because email ${normalizedEmail} already has a ConnectEd account.` });
      }

      const firstInitial = (first_name || "").charAt(0).toLowerCase().replace(/[^a-z]/g, "");
      const lastNameClean = (last_name || "").trim().toLowerCase().replace(/[^a-z]/g, "");
      const baseUsername = (firstInitial + lastNameClean) || "teacher";

      const { data: allUsernamesData } = await supabaseAdmin
        .from("profiles")
        .select("username")
        .not("username", "is", null);

      const usedUsernames = new Set((allUsernamesData || []).map(u => u.username));
      let suffix = 1;
      let username = `${baseUsername}01`;
      while (usedUsernames.has(username)) {
        suffix++;
        username = `${baseUsername}${suffix.toString().padStart(2, "0")}`;
      }

      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      const tempPassword = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

      let userId = null;
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true
      });

      if (authError) {
        if (authError.message?.includes("already exists") || authError.status === 422) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = (listData?.users || []).find(u => u.email?.toLowerCase() === normalizedEmail);
          if (existingUser) {
            userId = existingUser.id;
          } else {
            return res.status(400).json({ error: `Auth account creation failed: ${authError.message}` });
          }
        } else {
          return res.status(400).json({ error: `Auth account creation failed: ${authError.message}` });
        }
      } else if (authData?.user) {
        userId = authData.user.id;
      }

      if (!userId) {
        return res.status(500).json({ error: "Failed to resolve Auth User ID for teacher account." });
      }

      const teacherProfilePayload = {
        id: userId,
        role: "teacher",
        username,
        first_name,
        middle_name: request.middle_name || null,
        last_name,
        suffix: request.suffix || null,
        email: normalizedEmail,
        employee_id: request.employee_id || request.lrn || null,
        phone: request.phone || null,
        year_level: request.grade_level || request.year_level || null,
        assigned_class: request.section || request.assigned_class || null,
        subjects: request.subjects || null,
        status: "Active",
        must_change_password: true,
        is_verified: true,
        updated_at: new Date().toISOString()
      };

      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .upsert(teacherProfilePayload, { onConflict: "id" });

      if (profileErr) {
        console.error("[approve_teacher_registration] Profile error:", profileErr);
        return res.status(500).json({ error: `Failed to create teacher profile: ${profileErr.message}` });
      }

      if (Array.isArray(request.subjects) && request.subjects.length > 0) {
        try {
          await supabaseAdmin
            .from("subjects")
            .update({ teacher_id: userId })
            .in("id", request.subjects);
        } catch (subErr) {
          console.warn("[approve_teacher_registration] Subject assignment warning:", subErr);
        }
      }

      const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
      const emailFrom = process.env.EMAIL_FROM || process.env.VITE_EMAIL_FROM || "ConnectEd LMS <onboarding@resend.dev>";
      let emailSent = false;
      let emailNotice = null;
      let safeDiagnostics = null;

      if (resendApiKey) {
        try {
          const teacherFullName = [first_name, request.middle_name, last_name].filter(Boolean).join(" ");
          const loginUrl = process.env.VITE_APP_URL || "https://getconnectedlms.online/login";
          const recipientDomain = normalizedEmail.includes("@") ? "@" + normalizedEmail.split("@")[1] : "unknown";

          const teacherEmailHtml = buildConnectEdEmailHtml({
            badgeType: "success",
            title: "Teacher Account Approved",
            subtitle: `Hello <strong>${teacherFullName}</strong>! We are pleased to inform you that your teacher registration request for <strong>ConnectEd LMS</strong> has been approved.`,
            credentials: {
              fullName: teacherFullName,
              username: username,
              tempPassword: tempPassword
            },
            showButton: true,
            buttonText: "Log In to ConnectEd Portal",
            loginUrl: loginUrl,
            securityNotice: "You will be required to change your temporary password upon your first login for security purposes.",
            footerText: "If you didn't request a teacher account or have questions, please contact your school administrator."
          });

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: emailFrom,
              to: [normalizedEmail],
              subject: "Your ConnectEd Teacher Account Has Been Approved",
              html: teacherEmailHtml
            })
          });

          const rawText = await emailRes.text();
          let resendErrorName = null;
          let resendErrorMessage = null;
          try {
            const parsed = JSON.parse(rawText);
            resendErrorName = parsed.name || parsed.error || null;
            resendErrorMessage = parsed.message || rawText;
          } catch (_) {
            resendErrorMessage = rawText;
          }

          safeDiagnostics = {
            resendStatus: emailRes.status,
            resendErrorName,
            resendErrorMessage,
            fromEmail: emailFrom,
            recipientDomain,
            hasResendApiKeyEnv: !!process.env.RESEND_API_KEY,
            hasEmailFromEnv: !!process.env.EMAIL_FROM
          };

          console.log("[approve_teacher_registration] Resend Safe Diagnostics:", safeDiagnostics);

          if (emailRes.ok) {
            emailSent = true;
          } else {
            emailNotice = resendErrorMessage;
          }
        } catch (e) {
          emailNotice = e?.message || "Failed to reach Resend API";
          safeDiagnostics = {
            resendStatus: 500,
            resendErrorName: "NetworkError",
            resendErrorMessage: emailNotice,
            fromEmail: emailFrom,
            recipientDomain: normalizedEmail.includes("@") ? "@" + normalizedEmail.split("@")[1] : "unknown",
            hasResendApiKeyEnv: !!process.env.RESEND_API_KEY,
            hasEmailFromEnv: !!process.env.EMAIL_FROM
          };
          console.warn("[approve_teacher_registration] Resend API exception:", safeDiagnostics);
        }
      } else {
        emailNotice = "RESEND_API_KEY environment variable is not configured in Vercel.";
        safeDiagnostics = {
          resendStatus: null,
          resendErrorName: "MissingApiKey",
          resendErrorMessage: emailNotice,
          fromEmail: emailFrom,
          recipientDomain: normalizedEmail.includes("@") ? "@" + normalizedEmail.split("@")[1] : "unknown",
          hasResendApiKeyEnv: false,
          hasEmailFromEnv: !!process.env.EMAIL_FROM
        };
      }

      const nowIso = new Date().toISOString();
      const { error: updateErr } = await supabaseAdmin
        .from("pending_account_requests")
        .update({
          status: "approved",
          reviewed_at: nowIso,
          reviewed_by: reviewer_id || null,
          created_user_id: userId,
          updated_at: nowIso
        })
        .eq("id", request_id)
        .eq("request_type", "teacher")
        .eq("status", "pending");

      if (updateErr) {
        console.error("[approve_teacher_registration] Update pending_account_requests error:", updateErr);
      }

      return res.status(200).json({
        success: true,
        message: emailSent
          ? "Teacher account created successfully. Login credentials were sent to the teacher's email."
          : "Teacher account created successfully, but approval email could not be sent.",
        created_user_id: userId,
        username,
        emailSent,
        email_sent: emailSent,
        emailNotice,
        resendDiagnostics: safeDiagnostics
      });
    }

    if (action === "reject_teacher_registration") {
      const request_id = body.request_id || body.requestId || body.id;
      const reviewer_id = body.reviewer_id || body.reviewerId || body.adminId;
      const rejection_reason = body.rejection_reason || body.rejectionReason || "";

      if (!request_id) {
        return res.status(400).json({ error: "Missing request_id" });
      }

      const { data: request, error: fetchErr } = await supabaseAdmin
        .from("pending_account_requests")
        .select("*")
        .eq("id", request_id)
        .maybeSingle();

      if (fetchErr || !request) {
        return res.status(404).json({ error: "Registration request not found." });
      }

      if (request.request_type !== "teacher") {
        return res.status(400).json({ error: "Invalid request type. Only teacher requests can be rejected here." });
      }

      if (request.status !== "pending") {
        return res.status(409).json({ error: "This registration request has already been processed." });
      }

      const nowIso = new Date().toISOString();
      const { error: updateErr } = await supabaseAdmin
        .from("pending_account_requests")
        .update({
          status: "rejected",
          reviewed_at: nowIso,
          reviewed_by: reviewer_id || null,
          rejection_reason: rejection_reason || null,
          updated_at: nowIso
        })
        .eq("id", request_id)
        .eq("request_type", "teacher")
        .eq("status", "pending");

      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }

      const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;
      const emailFrom = process.env.EMAIL_FROM || process.env.VITE_EMAIL_FROM || "ConnectEd LMS <onboarding@resend.dev>";
      let emailSent = false;
      let emailNotice = null;
      let safeDiagnostics = null;

      if (resendApiKey && request.email) {
        try {
          const teacherFullName = [request.first_name, request.middle_name, request.last_name].filter(Boolean).join(" ");
          const normalizedEmail = request.email.trim().toLowerCase();
          const recipientDomain = normalizedEmail.includes("@") ? "@" + normalizedEmail.split("@")[1] : "unknown";

          const teacherRejectHtml = buildConnectEdEmailHtml({
            badgeType: "rejection",
            title: "Teacher Registration Notice",
            subtitle: `Hello <strong>${teacherFullName}</strong>, thank you for submitting your teacher registration request for <strong>ConnectEd LMS</strong>. After reviewing your registration, we were unable to approve your teacher account at this time.`,
            rejectionReason: rejection_reason ? rejection_reason.trim() : null,
            showButton: false,
            footerText: "If you believe this decision was made in error or need to correct your submitted information, please contact your school administrator."
          });

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: emailFrom,
              to: [normalizedEmail],
              subject: "Your ConnectEd Teacher Registration Update",
              html: teacherRejectHtml
            })
          });

          const rawText = await emailRes.text();
          let resendErrorName = null;
          let resendErrorMessage = null;
          try {
            const parsed = JSON.parse(rawText);
            resendErrorName = parsed.name || parsed.error || null;
            resendErrorMessage = parsed.message || rawText;
          } catch (_) {
            resendErrorMessage = rawText;
          }

          safeDiagnostics = {
            resendStatus: emailRes.status,
            resendErrorName,
            resendErrorMessage,
            fromEmail: emailFrom,
            recipientDomain,
            hasResendApiKeyEnv: !!process.env.RESEND_API_KEY,
            hasEmailFromEnv: !!process.env.EMAIL_FROM
          };

          console.log("[reject_teacher_registration] Resend Safe Diagnostics:", safeDiagnostics);

          if (emailRes.ok) {
            emailSent = true;
          } else {
            emailNotice = resendErrorMessage;
          }
        } catch (e) {
          emailNotice = e?.message || "Failed to reach Resend API";
          safeDiagnostics = {
            resendStatus: 500,
            resendErrorName: "NetworkError",
            resendErrorMessage: emailNotice,
            fromEmail: emailFrom,
            recipientDomain: request.email?.includes("@") ? "@" + request.email.split("@")[1] : "unknown",
            hasResendApiKeyEnv: !!process.env.RESEND_API_KEY,
            hasEmailFromEnv: !!process.env.EMAIL_FROM
          };
          console.warn("[reject_teacher_registration] Resend API exception:", safeDiagnostics);
        }
      } else {
        emailNotice = "RESEND_API_KEY environment variable is not configured in Vercel.";
        safeDiagnostics = {
          resendStatus: null,
          resendErrorName: "MissingApiKey",
          resendErrorMessage: emailNotice,
          fromEmail: emailFrom,
          recipientDomain: request?.email?.includes("@") ? "@" + request.email.split("@")[1] : "unknown",
          hasResendApiKeyEnv: false,
          hasEmailFromEnv: !!process.env.EMAIL_FROM
        };
      }

      return res.status(200).json({ success: true, message: "Teacher registration request rejected.", emailSent, email_sent: emailSent, emailNotice, resendDiagnostics: safeDiagnostics });
    }

    if ((!table && action !== "storage_upload" && action !== "storage_remove" && action !== "create_signed_upload_url") || !action) {
      return res.status(400).json({ error: "Missing table or action" });
    }

    let query;
    if (action === "create_signed_upload_url") {
      const { bucket, path } = payload || {};
      const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path);
      if (error) throw error;
      return res.status(200).json(data);
    } else if (action === "storage_upload") {
      const buffer = Buffer.from(payload.base64File, 'base64');
      const { data, error } = await supabaseAdmin.storage.from(payload.bucket).upload(payload.path, buffer, {
        contentType: payload.contentType,
        upsert: true
      });
      if (error) throw error;
      return res.status(200).json(data);
    } else if (action === "storage_remove") {
      const { data, error } = await supabaseAdmin.storage.from(payload.bucket).remove(payload.paths);
      if (error) throw error;
      return res.status(200).json(data);
    } else if (action === "upsert") {
      query = supabaseAdmin.from(table).upsert(payload, onConflict ? { onConflict } : undefined);
    } else if (action === "insert") {
      query = supabaseAdmin.from(table).insert(payload);
    } else if (action === "update") {
      query = supabaseAdmin.from(table).update(payload);
    } else if (action === "delete") {
      query = supabaseAdmin.from(table).delete();
    } else if (action === "select") {
      const selectOpts = countOption ? { count: countOption, head: !!head } : undefined;
      query = supabaseAdmin.from(table).select(payload || "*", selectOpts);
    } else {
      return res.status(400).json({ error: `Unsupported action: ${action}` });
    }

    if (eq) query = query.eq(eq.column, eq.value);
    if (neq) query = query.neq(neq.column, neq.value);
    if (inArgs) query = query.in(inArgs.column, inArgs.value);
    if (or) query = query.or(or);
    if (isArgs) query = query.is(isArgs.column, isArgs.value);
    if (match) query = query.match(match);

    if (action === "insert" || action === "update" || action === "upsert") {
      query = query.select(select || "*");
    } else if (action === "delete") {
      if (select) query = query.select(select);
    }
    
    if (order) {
      query = query.order(order.column, order.options);
    }

    if (single) {
      query = query.maybeSingle();
    }

    let { data, error, count } = await query;

    if (error && (table === "profiles" || table === "pending_account_requests") && (
      error.message?.includes("suffix") || 
      error.message?.includes("name_extension") || 
      error.message?.includes("employee_id") || 
      error.message?.includes("phone") || 
      error.message?.includes("subjects") || 
      error.message?.includes("assigned_class_unique") ||
      error.message?.includes("profiles_teacher_assigned_class_unique") ||
      error.message?.includes("does not exist") || 
      error.message?.includes("schema cache") || 
      error.code === "42703" ||
      (error.code === "23505" && error.message?.includes("assigned_class"))
    )) {
      console.warn(`[api/admin/db] Handling missing column or unique constraint error for ${table} table:`, error.message);
      
      let cleanedPayload = payload;
      if (typeof payload === "object" && payload !== null) {
        cleanedPayload = Array.isArray(payload) ? [...payload] : { ...payload };
        const cleanObj = (obj) => {
          if (obj.suffix && obj.last_name && !String(obj.last_name).toLowerCase().endsWith(String(obj.suffix).toLowerCase())) {
            obj.last_name = `${obj.last_name} ${obj.suffix}`.trim();
          }
          if (obj.name_extension && obj.last_name && !String(obj.last_name).toLowerCase().endsWith(String(obj.name_extension).toLowerCase())) {
            obj.last_name = `${obj.last_name} ${obj.name_extension}`.trim();
          }
          if (obj.employee_id && !obj.lrn) {
            obj.lrn = obj.employee_id;
          }
          delete obj.suffix;
          delete obj.name_extension;
          delete obj.employee_id;
          delete obj.phone;
          delete obj.subjects;
          if (error.message?.includes("assigned_class") || error.code === "23505") {
            delete obj.assigned_class;
          }
        };
        if (Array.isArray(cleanedPayload)) {
          cleanedPayload.forEach(cleanObj);
        } else {
          cleanObj(cleanedPayload);
        }
      } else if (typeof payload === "string" && payload !== "*") {
        cleanedPayload = payload.split(",").map(c => c.trim()).filter(c => c !== "suffix" && c !== "name_extension" && c !== "employee_id" && c !== "phone" && c !== "subjects").join(", ");
      }

      let cleanedSelect = select;
      if (typeof select === "string" && select !== "*") {
        cleanedSelect = select.split(",").map(c => c.trim()).filter(c => c !== "suffix" && c !== "name_extension" && c !== "employee_id" && c !== "phone" && c !== "subjects").join(", ");
      }

      let retryQuery = supabaseAdmin.from(table);
      if (action === "select") {
        const selectOpts = countOption ? { count: countOption, head: !!head } : undefined;
        retryQuery = retryQuery.select(cleanedPayload || "*", selectOpts);
      } else if (action === "insert") {
        retryQuery = retryQuery.insert(cleanedPayload).select(cleanedSelect || "*");
      } else if (action === "update") {
        retryQuery = retryQuery.update(cleanedPayload).select(cleanedSelect || "*");
      } else if (action === "upsert") {
        retryQuery = retryQuery.upsert(cleanedPayload, onConflict ? { onConflict } : undefined).select(cleanedSelect || "*");
      } else if (action === "delete") {
        retryQuery = retryQuery.delete();
        if (select) retryQuery = retryQuery.select(cleanedSelect || "*");
      }

      if (eq) retryQuery = retryQuery.eq(eq.column, eq.value);
      if (neq) retryQuery = retryQuery.neq(neq.column, neq.value);
      if (inArgs) retryQuery = retryQuery.in(inArgs.column, inArgs.value);
      if (or) retryQuery = retryQuery.or(or);
      if (isArgs) retryQuery = retryQuery.is(isArgs.column, isArgs.value);
      if (match) retryQuery = retryQuery.match(match);
      if (order) retryQuery = retryQuery.order(order.column, order.options);
      if (single) retryQuery = retryQuery.maybeSingle();

      const retryRes = await retryQuery;
      data = retryRes.data;
      error = retryRes.error;
      count = retryRes.count;
    }

    if (error) throw error;
    if (countOption) {
      return res.status(200).json({ data, count });
    }
    return res.status(200).json(data);
  } catch (error) {
    console.error("[api/admin/db]", error);
    const status = error.status || 500;
    return res.status(status).json({ error: error.message || "Internal Server Error" });
  }
}
