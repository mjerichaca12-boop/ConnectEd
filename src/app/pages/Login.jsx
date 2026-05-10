import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock, User } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import {
  STATIC_ADMIN_EMAIL,
  getStaticAdminSessionUser,
  normalizeEmail,
  validateStaticAdminCredentials
} from "../lib/staticAdminAuth";

/* DepEd brand colors: Green (DasmariÃ±as) + Blue + Red */
const GoogleLogo = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const GOOGLE_OAUTH_INTENT_KEY = "connected_google_oauth_intent";
const GOOGLE_VERIFICATION_SENT_KEY_PREFIX = "connected_google_verification_sent";
const GOOGLE_RESEND_COOLDOWN_SECONDS = 20;

function Login() {
  const [formData, setFormData] = useState({ usernameOrEmail: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [googleNotice, setGoogleNotice] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleResendEmail, setGoogleResendEmail] = useState("");
  const [showGoogleResend, setShowGoogleResend] = useState(false);
  const [googleResendLoading, setGoogleResendLoading] = useState(false);
  const [googleVerificationSending, setGoogleVerificationSending] = useState(false);
  const [googleResendCooldown, setGoogleResendCooldown] = useState(0);
  const oauthSessionProcessingRef = useRef(false);
  const navigate = useNavigate();

  const getGoogleVerificationSentKey = (email, userId) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedUserId = String(userId || "").trim();
    return `${GOOGLE_VERIFICATION_SENT_KEY_PREFIX}:${normalizedUserId || normalizedEmail}`;
  };

  const hasOAuthCallbackParams = () => {
    const searchParams = new URLSearchParams(window.location.search || "");
    const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));

    const hasSearchParams = searchParams.has("code") || searchParams.has("access_token") || searchParams.has("refresh_token") || searchParams.has("provider_token") || searchParams.has("error");
    const hasHashParams = hashParams.has("access_token") || hashParams.has("refresh_token") || hashParams.has("provider_token") || hashParams.has("error");

    console.log("OAuth callback check:", { hasSearchParams, hasHashParams, search: window.location.search, hash: window.location.hash });

    return hasSearchParams || hasHashParams;
  };

  const resolveTeacherRecordByEmail = async (email) => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return null;

    try {
      const profileLookup = await supabase
        .from("profiles")
        .select("*")
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle();

      if (!profileLookup.error && profileLookup.data) {
        const profileRole = String(profileLookup.data.role || "").trim().toLowerCase();
        if (profileRole === "teacher") {
          return profileLookup.data;
        }
      }

      const teacherLookup = await supabase
        .from("teachers")
        .select("*")
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle();

      if (!teacherLookup.error && teacherLookup.data) {
        const teacherRole = String(teacherLookup.data.role || "").trim().toLowerCase();
        if (!teacherRole || teacherRole === "teacher") {
          return teacherLookup.data;
        }
      }
    } catch (queryError) {
      // If we get auth errors, just return null - we'll handle this in createTeacherProfileFromGoogle
      console.warn("Auth error during teacher lookup:", queryError);
    }

    return null;
  };

  const findProfileByEmail = async (email) => {
    if (!supabase) return null;

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) return null;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle();

      if (error) {
        // If auth error, return null
        if (error.message?.includes('JWT') || error.message?.includes('auth') || error.code === 'PGRST301') {
          return null;
        }
        return null;
      }

      return data || null;
    } catch (queryError) {
      // If we get auth errors, just return null
      console.warn("Auth error during profile lookup:", queryError);
      return null;
    }
  };

  const getGoogleUserDisplayName = (sessionUser, email) => {
    const metadata = sessionUser?.user_metadata || {};
    const fullName = String(metadata.full_name || metadata.name || "").trim();
    if (fullName) return fullName;

    const givenName = String(metadata.given_name || "").trim();
    const familyName = String(metadata.family_name || "").trim();
    const combinedName = [givenName, familyName].filter(Boolean).join(" ").trim();
    if (combinedName) return combinedName;

    return String(email || "").split("@")[0] || "Teacher";
  };

  const splitFullName = (fullName, email) => {
    const normalized = String(fullName || "").trim().replace(/\s+/g, " ");
    const parts = normalized ? normalized.split(" ") : [];

    if (parts.length === 0) {
      return {
        firstName: String(email || "").split("@")[0] || "Teacher",
        middleName: null,
        lastName: null
      };
    }

    if (parts.length === 1) {
      return {
        firstName: parts[0],
        middleName: null,
        lastName: null
      };
    }

    if (parts.length === 2) {
      return {
        firstName: parts[0],
        middleName: null,
        lastName: parts[1]
      };
    }

    const firstName = parts[0];
    const remaining = parts.slice(1);
    const lastNameParticles = new Set(["de", "del", "dela", "la", "van", "von", "da", "dos", "di", "san", "st"]);
    const secondToLast = remaining[remaining.length - 2]?.toLowerCase();
    const useCompoundLastName = remaining.length >= 2 && lastNameParticles.has(secondToLast);
    const lastNameParts = useCompoundLastName ? remaining.slice(-2) : remaining.slice(-1);
    const middleNameParts = remaining.slice(0, remaining.length - lastNameParts.length);

    return {
      firstName,
      middleName: middleNameParts.length > 0 ? middleNameParts.join(" ") : null,
      lastName: lastNameParts.length > 0 ? lastNameParts.join(" ") : null
    };
  };

  const createTeacherProfileFromGoogle = async (sessionUser, email) => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();

    // Don't check for existing profile first - just try to create
    // Handle the error if it already exists
    const displayName = getGoogleUserDisplayName(sessionUser, normalizedEmail);
    const { firstName, middleName, lastName } = splitFullName(displayName, normalizedEmail);

    const payload = {
      id: String(sessionUser?.id || crypto.randomUUID()),
      role: "teacher",
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      email: normalizedEmail,
      status: "Active",
      provider: "google",
      is_verified: true  // Google emails are pre-verified
    };

    try {
      const { data, error } = await supabase
        .from("profiles")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        // Check if it's a duplicate key error (profile already exists)
        if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
          // Try to find the existing profile
          const existingProfile = await findProfileByEmail(normalizedEmail);
          if (existingProfile) {
            const existingRole = String(existingProfile.role || "").trim().toLowerCase();
            if (existingRole === "teacher") {
              // Update the provider to google if not set
              if (!existingProfile.provider) {
                try {
                  await supabase
                    .from("profiles")
                    .update({ provider: "google", is_verified: true })
                    .eq("id", existingProfile.id);
                  existingProfile.provider = "google";
                  existingProfile.is_verified = true;
                } catch (updateError) {
                  console.warn("Could not update existing profile:", updateError);
                }
              }
              return existingProfile;
            }
            throw new Error("This email already exists with a non-teacher account.");
          }
        }
        throw new Error(error.message || "Unable to create teacher profile.");
      }

      return data;
    } catch (createError) {
      // If creation fails, try to find existing profile as fallback
      const existingProfile = await findProfileByEmail(normalizedEmail);
      if (existingProfile) {
        const existingRole = String(existingProfile.role || "").trim().toLowerCase();
        if (existingRole === "teacher") {
          return existingProfile;
        }
        throw new Error("This email already exists with a non-teacher account.");
      }
      throw createError;
    }
  };

  const ensureTeacherIsActive = async (teacherRecord, email) => {
    if (!supabase || !teacherRecord) {
      return teacherRecord;
    }

    const normalizedEmail = String(email || teacherRecord.email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return teacherRecord;
    }

    const currentStatus = String(teacherRecord.status || "").trim().toLowerCase();
    if (currentStatus === "active") {
      return {
        ...teacherRecord,
        status: "Active"
      };
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ status: "Active" })
        .eq("role", "teacher")
        .ilike("email", normalizedEmail)
        .select("*")
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch (updateError) {
      console.warn("Auth error during status update:", updateError);
    }

    return {
      ...teacherRecord,
      status: "Active"
    };
  };

  const resolveDisplayName = (record, fallbackEmail) => {
    const firstName = String(record?.first_name || "").trim();
    const middleName = String(record?.middle_name || "").trim();
    const lastName = String(record?.last_name || "").trim();
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();

    if (fullName) return fullName;
    if (String(record?.full_name || "").trim()) return String(record.full_name).trim();
    if (String(record?.name || "").trim()) return String(record.name).trim();
    if (String(record?.teacher_name || "").trim()) return String(record.teacher_name).trim();

    const email = String(fallbackEmail || "").trim();
    return email ? email.split("@")[0] : "Teacher";
  };

  const completeTeacherSession = (email, teacherRecord) => {
    const nextUser = {
      id: String(teacherRecord?.id || ""),
      name: resolveDisplayName(teacherRecord, email),
      first_name: String(teacherRecord?.first_name || "").trim(),
      last_name: String(teacherRecord?.last_name || "").trim(),
      email: String(email || "").trim().toLowerCase(),
      role: "teacher"
    };

    localStorage.setItem("currentUser", JSON.stringify(nextUser));
    navigate("/teacher/dashboard", { replace: true });
  };

  const isGoogleProfileVerified = (record) => record?.is_verified !== false;

  const sendVerificationEmail = async ({ email, name }) => {
    if (!supabase) {
      throw new Error("Supabase client is not configured.");
    }

    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-verification`;
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ""}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || ""
      },
      body: JSON.stringify({ email, name })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // If it's a configuration error (missing env vars), don't throw
      if (response.status === 500 && data?.message?.includes("RESEND_API_KEY")) {
        console.warn("Email service not configured - skipping email send");
        return; // Don't throw, just return
      }
      throw new Error(data?.message || `Unable to send verification email. (${response.status})`);
    }

    if (!data?.ok) {
      throw new Error(data?.message || "Unable to send verification email.");
    }
  };

  useEffect(() => {
    if (googleResendCooldown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setGoogleResendCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [googleResendCooldown]);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let isMounted = true;
    const hasIntent = window.sessionStorage.getItem(GOOGLE_OAUTH_INTENT_KEY) === "1";
    const isOAuthCallback = hasOAuthCallbackParams();
    const shouldProcessOAuthSession = hasIntent || isOAuthCallback;

    console.log("OAuth processing check:", { hasIntent, isOAuthCallback, shouldProcessOAuthSession });

    if (!shouldProcessOAuthSession) {
      console.log("Not processing OAuth session - no intent or callback params");
      return undefined;
    }

    const handleOAuthSession = async (session) => {
      if (oauthSessionProcessingRef.current) {
        console.log("OAuth session already processing, skipping");
        return;
      }

      oauthSessionProcessingRef.current = true;
      const sessionEmail = String(session?.user?.email || "").trim().toLowerCase();
      console.log("Processing OAuth session for:", sessionEmail);

      if (!sessionEmail) {
        console.warn("No email in session");
        window.sessionStorage.removeItem(GOOGLE_OAUTH_INTENT_KEY);
        await supabase.auth.signOut();
        if (isMounted) {
          setGoogleError("Google login failed because no email was returned.");
          setGoogleNotice("");
          setShowGoogleResend(false);
          setGoogleResendEmail("");
          setGoogleLoading(false);
        }
        oauthSessionProcessingRef.current = false;
        return;
      }

      if (isMounted) {
        setGoogleLoading(true);
        setGoogleVerificationSending(false);
        setGoogleError("");
        setGoogleNotice("");
        setShowGoogleResend(false);
        setGoogleResendEmail("");
      }

      try {
        console.log("Looking up teacher record for:", sessionEmail);
        let teacherRecord = await resolveTeacherRecordByEmail(sessionEmail);
        let isNewGoogleUser = false;

        if (!teacherRecord) {
          console.log("No existing teacher record found (or auth error), creating new one");
          teacherRecord = await createTeacherProfileFromGoogle(session?.user, sessionEmail);
          isNewGoogleUser = true;
        } else {
          console.log("Found existing teacher record:", teacherRecord);
        }

        // For existing users, assume they need verification unless explicitly verified
        // But for Google users, consider them verified since Google validates emails
        const needsVerification = !isGoogleProfileVerified(teacherRecord) && teacherRecord.provider !== "google";

        if (needsVerification) {
          console.log("User needs verification, showing verification UI");
          // Don't sign out - keep session active so user can verify email
          window.sessionStorage.removeItem(GOOGLE_OAUTH_INTENT_KEY);
          if (isMounted) {
            setGoogleResendEmail(sessionEmail);
            setShowGoogleResend(true);
            setGoogleLoading(false);
          }

          // Always try to send verification email for unverified users
          const verificationSentKey = getGoogleVerificationSentKey(sessionEmail, session?.user?.id);
          const alreadySent = window.sessionStorage.getItem(verificationSentKey) === "1";

          if (!alreadySent) {
            try {
              if (isMounted) {
                setGoogleVerificationSending(true);
                setGoogleNotice("Sending verification email...");
              }

              const displayName = getGoogleUserDisplayName(session?.user, sessionEmail);
              console.log("Sending verification email to:", sessionEmail);
              await sendVerificationEmail({ email: sessionEmail, name: displayName });
              window.sessionStorage.setItem(verificationSentKey, "1");

              if (isMounted) {
                setGoogleNotice("Verification email sent. Please check your inbox.");
                setGoogleResendCooldown(GOOGLE_RESEND_COOLDOWN_SECONDS);
              }
            } catch (verificationError) {
              console.error("Verification email error:", verificationError);
              if (isMounted) {
                // Don't fail the login if email sending fails - just show a warning
                setGoogleNotice("Login successful, but we could not send verification email. Please contact support if needed.");
                setGoogleResendCooldown(GOOGLE_RESEND_COOLDOWN_SECONDS);
              }
            } finally {
              if (isMounted) {
                setGoogleVerificationSending(false);
              }
            }
          } else if (isMounted) {
            setGoogleNotice("Verification email already sent. Please check your inbox.");
          }

          oauthSessionProcessingRef.current = false;
          return;
        }

        console.log("User is verified, completing login");
        teacherRecord = await ensureTeacherIsActive(teacherRecord, sessionEmail);

        if (isMounted) {
          window.sessionStorage.removeItem(GOOGLE_OAUTH_INTENT_KEY);
          completeTeacherSession(sessionEmail, teacherRecord);
        }
      } catch (authError) {
        console.error("OAuth session error:", authError);
        window.sessionStorage.removeItem(GOOGLE_OAUTH_INTENT_KEY);
        await supabase.auth.signOut();
        localStorage.removeItem("currentUser");
        if (isMounted) {
          setGoogleError(authError instanceof Error ? authError.message : "Unable to complete Google login.");
          setGoogleNotice("");
          setShowGoogleResend(false);
          setGoogleResendEmail("");
          setGoogleLoading(false);
        }
      } finally {
        oauthSessionProcessingRef.current = false;
      }
    };

    const initializeSession = async () => {
      console.log("Initializing session...");
      console.log("Current URL:", window.location.href);
      console.log("localStorage keys:", Object.keys(localStorage).filter(key => key.includes('supabase') || key.includes('sb-')));
      console.log("Supabase auth keys:", Object.keys(localStorage).filter(key => key.startsWith('sb-')));

      // First check if there are OAuth callback params in URL
      const isOAuthCallback = hasOAuthCallbackParams();
      console.log("Is OAuth callback:", isOAuthCallback);

      if (isOAuthCallback) {
        console.log("Detected OAuth callback, manually processing session...");
        try {
          // Manually extract tokens from URL hash
          const hashParams = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          console.log("Extracted tokens from hash:", { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });

          if (accessToken && refreshToken) {
            console.log("Setting session from hash tokens...");
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (sessionError) {
              console.warn("Error setting session from hash:", sessionError);
            } else {
              console.log("Session set successfully from hash");

              // Clean up the URL by removing hash params
              if (window.location.hash) {
                console.log("Cleaning up URL hash...");
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
              }
            }
          } else {
            console.warn("No access_token or refresh_token found in hash");
          }
        } catch (manualError) {
          console.warn("Manual session processing failed:", manualError);
        }
        // Continue with normal flow after manual processing
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.warn("Session error:", sessionError);
        window.sessionStorage.removeItem(GOOGLE_OAUTH_INTENT_KEY);
        if (isMounted) {
          setGoogleError(sessionError.message);
        }
        return;
      }

      console.log("Session data:", data);

      if (data?.session?.user) {
        console.log("Found existing session for:", data.session.user.email);
        // Check if user just came back from verification
        const sessionEmail = String(data.session.user.email || "").trim().toLowerCase();
        if (sessionEmail) {
          try {
            const teacherRecord = await resolveTeacherRecordByEmail(sessionEmail);
            if (teacherRecord && isGoogleProfileVerified(teacherRecord)) {
              console.log("User is verified, completing login");
              teacherRecord = await ensureTeacherIsActive(teacherRecord, sessionEmail);
              if (isMounted) {
                window.sessionStorage.removeItem(GOOGLE_OAUTH_INTENT_KEY);
                completeTeacherSession(sessionEmail, teacherRecord);
              }
              return;
            } else {
              console.log("User not verified, showing verification UI");
            }
          } catch (checkError) {
            console.warn("Error checking verification status:", checkError);
          }
        }

        // Handle normal OAuth session
        await handleOAuthSession(data.session);
      } else {
        console.log("No existing session found");
        window.sessionStorage.removeItem(GOOGLE_OAUTH_INTENT_KEY);
        if (isMounted) {
          setGoogleLoading(false);
        }
      }
    };

    initializeSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log("Auth state change:", _event, session?.user?.email, !!session);
      if (session?.user) {
        console.log("Session established for:", session.user.email);
        console.log("Session object:", session);
        // Check if localStorage has the session now
        const storedKeys = Object.keys(localStorage).filter(key => key.startsWith('sb-'));
        console.log("Stored session keys after auth change:", storedKeys);
        await handleOAuthSession(session);
      } else {
        console.log("No session in auth state change");
      }
    });

    return () => {
      isMounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [navigate]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.usernameOrEmail || !formData.password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    const normalizedEmail = normalizeEmail(formData.usernameOrEmail);

    if (normalizedEmail === STATIC_ADMIN_EMAIL) {
      const adminValidation = await validateStaticAdminCredentials(formData.usernameOrEmail, formData.password);
      if (!adminValidation.ok) {
        setError(adminValidation.message);
        setLoading(false);
        return;
      }

      localStorage.setItem("currentUser", JSON.stringify(getStaticAdminSessionUser()));
      setLoading(false);
      navigate("/admin/dashboard", { replace: true });
      return;
    }

    // Check if the teacher account is verified (for invitation-based teachers)
    try {
      if (supabase) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("is_verified, status, role")
          .ilike("email", normalizedEmail)
          .limit(1)
          .maybeSingle();

        if (!profileError && profile) {
          const profileRole = String(profile.role || "").trim().toLowerCase();
          
          // If it's a teacher and not verified, check if they have an active invitation
          if (profileRole === "teacher" && profile.is_verified === false) {
            const { data: invitation } = await supabase
              .from("teacher_invitation_tokens")
              .select("used_at")
              .ilike("email", normalizedEmail)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            // If no valid invitation, ask them to request access or contact admin
            if (!invitation || invitation.used_at) {
              setError("Your account is not yet verified. Please request access or contact an administrator.");
              setLoading(false);
              return;
            }
          }

          // Also check status
          if (profileRole === "teacher") {
            const status = String(profile.status || "").trim().toLowerCase();
            if (status !== "active") {
              setError("Your account is not active. Please contact an administrator.");
              setLoading(false);
              return;
            }
          }
        }
      }
    } catch (err) {
      console.error("Error checking profile verification:", err);
      // Continue with login attempt anyway in case of error
    }

    setTimeout(() => {
      localStorage.setItem("currentUser", JSON.stringify({
        name: formData.usernameOrEmail.split("@")[0] || "Teacher",
        email: formData.usernameOrEmail,
        role: "teacher",
      }));
      setLoading(false);
      navigate("/teacher/dashboard", { replace: true });
    }, 900);
  };

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setGoogleError("Supabase client is not configured.");
      return;
    }

    setGoogleError("");
    setGoogleNotice("");
    setShowGoogleResend(false);
    setGoogleResendEmail("");
    setGoogleLoading(true);
    window.sessionStorage.setItem(GOOGLE_OAUTH_INTENT_KEY, "1");

    // Clear any stale auth session so Google always shows account selection.
    await supabase.auth.signOut();

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: {
          prompt: "select_account"
        }
      }
    });

    if (oauthError) {
      window.sessionStorage.removeItem(GOOGLE_OAUTH_INTENT_KEY);
      setGoogleError(oauthError.message || "Unable to start Google login.");
      setGoogleNotice("");
      setGoogleLoading(false);
    }
  };

  const clearStorageAndTest = async () => {
    console.log("=== CLEARING STORAGE ===");
    // Clear all Supabase-related localStorage keys
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('sb-')) {
        console.log("Removing:", key);
        localStorage.removeItem(key);
      }
    });

    // Also clear session storage
    window.sessionStorage.clear();

    console.log("Storage cleared. Please refresh the page and try login again.");
    console.log("===================");
  };

  const testSession = async () => {
    console.log("=== SESSION TEST ===");
    console.log("Current URL:", window.location.href);
    console.log("localStorage keys:", Object.keys(localStorage));
    const supabaseKeys = Object.keys(localStorage).filter(key => key.includes('supabase') || key.includes('sb-'));
    console.log("Supabase-related keys:", supabaseKeys);

    supabaseKeys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        console.log(`${key}:`, value ? JSON.parse(value) : 'null/empty');
      } catch (e) {
        console.log(`${key}:`, localStorage.getItem(key));
      }
    });

    const { data, error } = await supabase.auth.getSession();
    console.log("getSession result:", { data, error });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    console.log("getUser result:", { userData, error: userError });

    // Test manual session setting if we have URL params
    const isOAuthCallback = hasOAuthCallbackParams();
    if (isOAuthCallback && data?.session) {
      console.log("Trying manual session set...");
      try {
        const setResult = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });
        console.log("Manual setSession result:", setResult);
      } catch (setError) {
        console.warn("Manual setSession failed:", setError);
      }
    }

    console.log("===================");
  };

  const highlights = [
    { color: "bg-emerald-500", label: "DasmariÃ±as City Schools Division" },
    { color: "bg-blue-600",   label: "Department of Education (DepEd)" },
    { color: "bg-red-600",    label: "Public School Management System" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* â”€â”€ LEFT PANEL â”€â”€ */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-12 bg-green-600">
        {/* DepEd tri-color top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="flex-1 bg-emerald-500" />
          <div className="flex-1 bg-blue-600" />
          <div className="flex-1 bg-red-600" />
        </div>

        {/* Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff15_1px,transparent_1px),linear-gradient(to_bottom,#ffffff15_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-0 w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-green-100 hover:text-white text-sm font-medium transition-colors mb-16">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>

        {/* Brand lockup */}
          <div className="flex items-center gap-3 mb-2">
            <div>
              <p className="text-white font-extrabold text-2xl tracking-tight leading-none">
                Connect<span className="text-green-300">Ed</span>
              </p>
              <p className="text-green-200 text-xs font-medium mt-0.5">Teacher Portal Â· Web Platform</p>
            </div>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mt-10 mb-4 tracking-tight">
            Welcome back,<br />
            <span className="text-white">
              Educator.
            </span>
          </h1>
          <p className="text-green-100 text-base leading-relaxed max-w-md">
            Log in to manage your classes, record grades, track attendance, and stay connected with your students.
          </p>
        </div>

        {/* Bottom */}
        <div className="mt-auto">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-1 bg-green-400 rounded" />
            <div className="w-8 h-1 bg-blue-400 rounded" />
            <div className="w-8 h-1 bg-red-400 rounded" />
          </div>
          <p className="text-green-200 text-xs">
            ConnectEd Â· Official School Management System Â· DasmariÃ±as, Cavite
          </p>
        </div>
      </div>

      {/* â”€â”€ RIGHT PANEL â”€â”€ */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative bg-white">
        {/* DepEd tri-color right accent */}
        <div className="absolute top-0 right-0 bottom-0 w-0.5 flex flex-col lg:flex">
          <div className="flex-1 bg-green-500/40" />
          <div className="flex-1 bg-blue-600/40" />
          <div className="flex-1 bg-red-600/40" />
        </div>

        <button onClick={() => navigate("/")} className="lg:hidden absolute top-6 left-6 inline-flex items-center gap-2 text-gray-500 hover:text-green-600 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Home
        </button>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10 justify-center">
            <span className="text-gray-900 font-extrabold text-xl">Connect<span className="text-green-600">Ed</span></span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Sign in to your account</h2>
            <p className="text-gray-500 text-sm">Enter your credentials to continue</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-medium px-4 py-3 rounded-xl border border-gray-200 transition-all shadow-sm mb-3 text-sm"
          >
            <GoogleLogo />
            {googleLoading ? "Connecting to Google..." : "Continue with Google"}
          </button>

          {/* Debug Test Button */}
          <button
            type="button"
            onClick={testSession}
            className="w-full flex items-center justify-center gap-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded-xl border border-gray-300 transition-all text-xs mb-2"
          >
            🔍 Check Session Status
          </button>

          {/* Clear Storage Button */}
          <button
            type="button"
            onClick={clearStorageAndTest}
            className="w-full flex items-center justify-center gap-3 bg-red-100 hover:bg-red-200 text-red-700 font-medium px-4 py-2 rounded-xl border border-red-300 transition-all text-xs mb-5"
          >
            🗑️ Clear Storage & Test
          </button>
          {googleNotice && (
            <div className="mb-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-green-700 text-xs">{googleNotice}</p>
            </div>
          )}
          {googleError && <p className="text-red-600 text-xs mb-3">{googleError}</p>}
          {showGoogleResend && (
            <button
              type="button"
              onClick={handleGoogleResendVerification}
              disabled={googleResendLoading || googleVerificationSending || googleResendCooldown > 0}
              className="w-full mb-4 px-4 py-2.5 text-xs font-semibold rounded-xl border border-green-200 text-green-700 hover:text-green-800 hover:bg-green-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {googleVerificationSending
                ? "Sending verification email..."
                : googleResendLoading
                  ? "Resending verification email..."
                  : googleResendCooldown > 0
                    ? `Resend available in ${googleResendCooldown}s`
                    : "Resend verification email"}
            </button>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-gray-500 text-xs font-medium">or sign in with credentials</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username or Email</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  name="usernameOrEmail"
                  value={formData.usernameOrEmail}
                  onChange={handleInputChange}
                  placeholder="e.g. teacher@school.edu.ph"
                  autoComplete="username"
                  className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Link to="/forgot-password" className="text-xs text-green-600 hover:text-green-700 transition-colors">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 pl-11 pr-12 py-3 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all text-sm"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all shadow-sm text-sm mt-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
              ) : "Sign In"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            {/* Tri-color dots */}
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>
            <p className="text-gray-500 text-xs">ConnectEd Teacher Portal Â· Official Web Platform</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Login };
