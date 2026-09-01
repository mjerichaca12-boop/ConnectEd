import { createClient } from "@supabase/supabase-js";

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin credentials are not configured.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: "Missing email or role" });
    }

    // 1. Look up user ID by email and role
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.trim())
      .eq("role", role)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
      return res.status(500).json({ error: "Database error during profile lookup" });
    }

    // 2. Insert into password_reset_requests
    const { error: insertError } = await supabase
      .from("password_reset_requests")
      .insert({
        user_id: userProfile?.id || null,
        email: email.trim(),
        role: role,
        status: "Pending"
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).json({ error: "Failed to submit reset request" });
    }

    return res.status(200).json({ success: true, message: "Reset request submitted successfully." });
  } catch (error) {
    console.error("Reset request handler error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
