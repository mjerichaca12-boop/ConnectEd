import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock, User, ShieldAlert } from "lucide-react";
import { getAuthRedirectUrl, supabase } from "../lib/supabaseClient";
import {
  STATIC_ADMIN_EMAIL,
  STATIC_ADMIN_ALIASES,
  getStaticAdminSessionUser,
  normalizeEmail,
  validateStaticAdminCredentials
} from "../lib/staticAdminAuth";

const GoogleLogo = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const isValidEmailFormat = (str) => {
  return typeof str === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
};

function Login() {
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ username: "", password: "" });
  const [touched, setTouched] = useState({ username: false, password: false });
  const [loading, setLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const oauthSessionProcessingRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabase) return;

    const handleOAuthSession = async (session) => {
      if (oauthSessionProcessingRef.current) return;
      oauthSessionProcessingRef.current = true;

      const oauthIntent = localStorage.getItem(GOOGLE_OAUTH_INTENT_KEY);
      if (!oauthIntent) {
        oauthSessionProcessingRef.current = false;
        return;
      }
      
      const email = session?.user?.email;
      if (!email) {
        setGoogleError("Google login failed: No email returned.");
        setGoogleLoading(false);
        oauthSessionProcessingRef.current = false;
        return;
      }

      setGoogleLoading(true);

      try {
        let profile;
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("*")
          .ilike("email", email)
          .maybeSingle();

        if (existingProfile) {
          profile = existingProfile;
        } else {
          const normalizedEmail = email.toLowerCase();
          const detectedRole = normalizedEmail.includes("admin") ? "admin" : "teacher";

          const displayName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || email.split("@")[0] || "Teacher";
          const nameParts = displayName.trim().split(" ");
          const firstName = nameParts[0] || "Teacher";
          const lastName = nameParts.slice(1).join(" ") || "User";

          const payload = {
            id: session.user.id,
            email: normalizedEmail,
            role: detectedRole,
            first_name: firstName,
            last_name: lastName,
            status: "Active",
            provider: "google",
            is_verified: true,
            created_at: new Date().toISOString()
          };

          const { data: created, error: insertError } = await supabase
            .from("profiles")
            .insert(payload)
            .select("*")
            .single();

          if (insertError) {
            const { data: fallback } = await supabase
              .from("profiles")
              .select("*")
              .ilike("email", normalizedEmail)
              .maybeSingle();
            profile = fallback;
          } else {
            profile = created;
          }
        }

        if (!profile) throw new Error("Could not find or create user profile.");

        const role = String(profile.role || "teacher").toLowerCase();

        if (role === "student") {
          throw new Error("Student accounts must use the ConnectEd Mobile App. Web portal is for Teachers and Administrators.");
        }

        const hasCompletedLoginSession = localStorage.getItem("hasCompletedLoginSession_" + profile.id);
        const isFirstLogin = !hasCompletedLoginSession;
        if (isFirstLogin) {
          localStorage.setItem("hasCompletedLoginSession_" + profile.id, "true");
        }

        const currentUser = {
          id: profile.id,
          name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || (role === "admin" ? "Administrator" : "Teacher"),
          email: profile.email,
          role: role,
          avatar_url: profile.avatar_url || "",
          isFirstLogin: isFirstLogin
        };

        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        
        if (role === "admin") navigate("/admin/dashboard", { replace: true });
        else if (role === "teacher") navigate("/teacher/dashboard", { replace: true });
        else throw new Error("Unsupported account role. Please contact an administrator.");

      } catch (err) {
        console.error("OAuth Error:", err);
        setGoogleError(err.message || "Unable to complete Google login.");
        await supabase.auth.signOut();
      } finally {
        setGoogleLoading(false);
        oauthSessionProcessingRef.current = false;
        localStorage.removeItem(GOOGLE_OAUTH_INTENT_KEY);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && localStorage.getItem(GOOGLE_OAUTH_INTENT_KEY)) {
        await handleOAuthSession(session);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const RATE_LIMIT_KEY_PREFIX = "connected_login_rate_limit_";
  const MAX_FAILED_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 60 * 1000;

  const getRateLimitState = (username) => {
    if (!username) return { attempts: 0, lockoutUntil: 0 };
    try {
      const key = RATE_LIMIT_KEY_PREFIX + String(username).trim().toLowerCase();
      const raw = localStorage.getItem(key);
      if (!raw) return { attempts: 0, lockoutUntil: 0 };
      return JSON.parse(raw);
    } catch {
      return { attempts: 0, lockoutUntil: 0 };
    }
  };

  const recordFailedAttempt = (username) => {
    if (!username) return;
    const key = RATE_LIMIT_KEY_PREFIX + String(username).trim().toLowerCase();
    const current = getRateLimitState(username);
    const nextAttempts = current.attempts + 1;
    const lockoutUntil = nextAttempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : 0;
    localStorage.setItem(key, JSON.stringify({ attempts: nextAttempts, lockoutUntil }));
  };

  const clearRateLimitState = (username) => {
    if (!username) return;
    const key = RATE_LIMIT_KEY_PREFIX + String(username).trim().toLowerCase();
    localStorage.removeItem(key);
  };

  const validateField = (name, value) => {
    if (name === "username") {
      const val = String(value || "").trim();
      if (!val) return "Please enter your username or email address.";
      if (value.includes(" ")) return "Username or email cannot contain spaces.";
      if (val.length > 100) return "Username or email cannot exceed 100 characters.";
    }
    if (name === "password") {
      if (!value) return "Please enter your password.";
      if (value.length > 128) return "Password cannot exceed 128 characters.";
    }
    return "";
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError("");
    if (touched[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const isSubmittingRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || isSubmittingRef.current) return;

    const usernameErr = validateField("username", formData.username);
    const passwordErr = validateField("password", formData.password);
    setTouched({ username: true, password: true });
    setFieldErrors({ username: usernameErr, password: passwordErr });
    if (usernameErr || passwordErr) return;

    const normalizedUsername = formData.username.trim().toLowerCase();
    const rateState = getRateLimitState(normalizedUsername);

    if (rateState.lockoutUntil && rateState.lockoutUntil > Date.now()) {
      const remainingSec = Math.ceil((rateState.lockoutUntil - Date.now()) / 1000);
      setError(`Too many failed login attempts. Please wait ${remainingSec} seconds before trying again.`);
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    // 1. Check if identifier is a Static Admin alias
    if (STATIC_ADMIN_ALIASES.includes(normalizedUsername)) {
      const adminValidation = await validateStaticAdminCredentials(normalizedUsername, formData.password);
      if (adminValidation.ok) {
        clearRateLimitState(normalizedUsername);
        localStorage.setItem("currentUser", JSON.stringify(getStaticAdminSessionUser(adminValidation.token)));
        navigate("/admin/dashboard", { replace: true });
        isSubmittingRef.current = false;
        return;
      }
      // If password did not match static admin, continue to check Supabase Auth in case account exists in DB
    }

    try {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (signOutError) {
        console.warn("LOGIN signOut cleanup warning:", signOutError);
      }

      // 2. Resolve email from username or direct input
      let resolvedEmail = null;
      let resolvedProfile = null;

      if (normalizedUsername.includes("@")) {
        resolvedEmail = normalizedUsername;
      } else {
        // Try RPC lookup first
        try {
          const { data: rpcEmail } = await supabase.rpc('get_email_by_username', { p_username: normalizedUsername });
          if (rpcEmail) {
            resolvedEmail = String(rpcEmail).trim().toLowerCase();
          }
        } catch (rpcErr) {
          console.warn("RPC get_email_by_username error (fallback to profiles table):", rpcErr);
        }

        // Direct table query lookup if RPC didn't return
        if (!resolvedEmail) {
          try {
            const { data: profData } = await supabase
              .from("profiles")
              .select("*")
              .or(`username.ilike.${normalizedUsername},email.ilike.${normalizedUsername},employee_id.ilike.${normalizedUsername}`)
              .maybeSingle();

            if (profData?.email) {
              resolvedEmail = String(profData.email).trim().toLowerCase();
              resolvedProfile = profData;
            }
          } catch (profSelectErr) {
            console.warn("Profiles lookup error:", profSelectErr);
          }
        }
      }

      // 3. Build candidate login emails
      const candidateEmails = [];
      if (resolvedEmail && isValidEmailFormat(resolvedEmail)) {
        candidateEmails.push(resolvedEmail);
      }
      if (normalizedUsername.includes("@") && isValidEmailFormat(normalizedUsername) && !candidateEmails.includes(normalizedUsername)) {
        candidateEmails.push(normalizedUsername);
      }
      if (!normalizedUsername.includes("@")) {
        const domainEmail = `${normalizedUsername}@connectedlms.online`;
        const tempEmail = `${normalizedUsername}@temp.local`;
        if (isValidEmailFormat(domainEmail) && !candidateEmails.includes(domainEmail)) {
          candidateEmails.push(domainEmail);
        }
        if (isValidEmailFormat(tempEmail) && !candidateEmails.includes(tempEmail)) {
          candidateEmails.push(tempEmail);
        }
      }

      let authData = null;
      let authError = null;
      let authMessage = "";

      for (const candidateEmail of candidateEmails) {
        const { data: sData, error: sErr } = await supabase.auth.signInWithPassword({
          email: candidateEmail,
          password: formData.password
        });

        if (!sErr && sData?.session) {
          authData = sData;
          authError = null;
          break;
        } else {
          authError = sErr;
          authMessage = String(sErr?.message || "").toLowerCase();
        }
      }

      if (authError || !authData) {
        recordFailedAttempt(normalizedUsername);
        const updatedRate = getRateLimitState(normalizedUsername);
        if (updatedRate.lockoutUntil > Date.now()) {
          setError("Too many login attempts. Please wait and try again later.");
        } else if (authMessage.includes("invalid login credentials") || authMessage.includes("invalid")) {
          const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - updatedRate.attempts);
          setError(`Incorrect username/email or password. (${remainingAttempts} attempt(s) remaining)`);
        } else if (authMessage.includes("email not confirmed")) {
          setError("Please verify your email before signing in.");
        } else if (authMessage.includes("fetch") || authMessage.includes("network") || authMessage.includes("failed to fetch")) {
          setError("Unable to connect to authentication server. Please check your internet connection.");
        } else {
          setError("Incorrect username/email or password.");
        }
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      clearRateLimitState(normalizedUsername);

      // 4. Fetch profile by auth user ID first, fallback to resolved email
      let profile = resolvedProfile;
      const userId = authData.session?.user?.id;
      if (userId) {
        const { data: pById } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (pById) profile = pById;
      }

      if (!profile && resolvedEmail) {
        const { data: pByEmail } = await supabase
          .from("profiles")
          .select("*")
          .ilike("email", resolvedEmail)
          .maybeSingle();
        if (pByEmail) profile = pByEmail;
      }

      if (!profile) {
        await supabase.auth.signOut();
        setError("User account profile not found. Please contact the administrator.");
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      if (profile.status === "Pending" || profile.status === "Inactive" || profile.status === "Disabled") {
        await supabase.auth.signOut();
        setError("Your account is currently disabled or pending administrator approval.");
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      const role = String(profile.role || "teacher").toLowerCase();

      // Direct students to the mobile app
      if (role === "student") {
        await supabase.auth.signOut();
        setError("Student accounts must sign in via the ConnectEd Mobile App. Web portal is for Teachers and Administrators.");
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      const hasCompletedLoginSession = localStorage.getItem("hasCompletedLoginSession_" + profile.id);
      const isFirstLogin = !hasCompletedLoginSession;
      if (isFirstLogin && profile.must_change_password !== true) {
        localStorage.setItem("hasCompletedLoginSession_" + profile.id, "true");
      }

      const fullName = [profile.first_name, profile.middle_name, profile.last_name].map(p => String(p || "").trim()).filter(Boolean).join(" ");

      localStorage.setItem("currentUser", JSON.stringify({
        id: profile.id,
        name: fullName || (role === "admin" ? "Administrator" : "Teacher"),
        email: profile.email,
        role: role,
        avatar_url: profile.avatar_url || "",
        must_change_password: profile.must_change_password === true,
        isFirstLogin: isFirstLogin
      }));

      if (profile.must_change_password === true) {
        navigate("/change-password", { replace: true });
      } else if (role === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else if (role === "teacher") {
        navigate("/teacher/dashboard", { replace: true });
      } else {
        throw new Error("Unsupported account role. Please contact an administrator.");
      }

    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError(err instanceof Error ? err.message : "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-gray-50 to-blue-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block text-3xl font-extrabold text-gray-900 mb-2 tracking-tight hover:opacity-90 transition-opacity">
            Connect<span className="text-emerald-600">Ed</span>
          </Link>
          <p className="text-gray-500 text-sm font-medium">Teacher & Administrator Portal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Username or Email</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                onBlur={handleBlur}
                autoComplete="username"
                autoCapitalize="none"
                className={`w-full pl-11 pr-4 py-3.5 bg-gray-50 border rounded-xl focus:ring-2 outline-none transition-all text-sm font-medium ${
                  touched.username && fieldErrors.username
                    ? "border-red-400 focus:ring-red-300 bg-red-50"
                    : "border-gray-200 focus:ring-emerald-500 focus:bg-white"
                }`}
                placeholder="Enter your username or email"
              />
            </div>
            {touched.username && fieldErrors.username && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                {fieldErrors.username}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                onBlur={handleBlur}
                autoComplete="current-password"
                className={`w-full pl-11 pr-12 py-3.5 bg-gray-50 border rounded-xl focus:ring-2 outline-none transition-all text-sm font-medium ${
                  touched.password && fieldErrors.password
                    ? "border-red-400 focus:ring-red-300 bg-red-50"
                    : "border-gray-200 focus:ring-emerald-500 focus:bg-white"
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {touched.password && fieldErrors.password ? (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                {fieldErrors.password}
              </p>
            ) : (
              <div className="mt-2 text-right">
                <Link to="/forgot-password" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">
                  Forgot Password?
                </Link>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2.5 animate-shake">
              <span className="mt-0.5 w-4 h-4 flex-shrink-0 text-red-500 font-bold">&#9888;</span>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 mt-2 cursor-pointer"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Informative Footer */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Student accounts access school via the <span className="font-semibold text-gray-600">ConnectEd Mobile App</span>.
          </p>
        </div>

      </div>
    </div>
  );
}

export { Login };
