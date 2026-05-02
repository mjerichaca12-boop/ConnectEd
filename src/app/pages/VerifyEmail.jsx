import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

function VerifyEmail() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your account...");
  const [email, setEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const navigate = useNavigate();

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search || "");
    return String(params.get("token") || "").trim();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const verifyToken = async () => {
      if (!token) {
        if (isMounted) {
          setStatus("error");
          setMessage("Missing verification token.");
        }
        return;
      }

      if (!supabase) {
        if (isMounted) {
          setStatus("error");
          setMessage("Supabase client is not configured.");
        }
        return;
      }

      const verifyResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ""}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || ""
        },
        body: JSON.stringify({ token })
      });

      const data = await verifyResponse.json().catch(() => ({}));

      if (!verifyResponse.ok || !data?.ok) {
        if (isMounted) {
          setStatus("error");
          setMessage(data?.message || "Verification link is invalid or expired.");
        }
        return;
      }

      if (isMounted) {
        setStatus("success");
        setMessage(data?.message || "Your account has been verified. You can now log in.");
        if (data?.email) {
          setEmail(String(data.email));
        }
      }
    };

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      setResendError("Please enter your email address.");
      return;
    }

    if (!supabase) {
      setResendError("Supabase client is not configured.");
      return;
    }

    setResendLoading(true);
    setResendError("");
    setResendMessage("");

    try {
      const resendResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY || ""}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || ""
        },
        body: JSON.stringify({ email })
      });

      const data = await resendResponse.json().catch(() => ({}));

      if (!resendResponse.ok || !data?.ok) {
        throw new Error(data?.message || "Unable to resend verification email.");
      }

      setResendMessage("Verification email sent. Please check your inbox.");
    } catch (resendErr) {
      setResendError(resendErr instanceof Error ? resendErr.message : "Unable to resend verification email.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-emerald-300 text-sm transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to login
        </button>

        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            {status === "success" ? (
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-400" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Email Verification</h1>
            <p className="text-sm text-gray-400 mt-1">{message}</p>
          </div>
        </div>

        {status === "success" && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-emerald-300 text-sm">Your account is verified. You can now log in.</p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-emerald-300 text-sm font-semibold mt-3"
            >
              Go to login
            </Link>
          </div>
        )}

        {status !== "success" && (
          <div className="border-t border-white/10 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-5 h-5 text-emerald-300" />
              <p className="text-sm text-gray-300">Resend verification email</p>
            </div>

            <form onSubmit={handleResend} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setResendError("");
                  }}
                  placeholder="teacher@school.edu.ph"
                  className="w-full bg-gray-950 border border-white/10 text-white placeholder-gray-600 px-4 py-3 rounded-xl focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm"
                />
              </div>

              {resendError && <p className="text-xs text-red-400">{resendError}</p>}
              {resendMessage && <p className="text-xs text-emerald-300">{resendMessage}</p>}

              <button
                type="submit"
                disabled={resendLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all text-sm"
              >
                {resendLoading ? "Resending..." : "Resend verification email"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export { VerifyEmail };
