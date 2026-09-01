import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { getAuthRedirectUrl, supabase } from "../lib/supabaseClient";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const navigate = useNavigate();

  const isSubmittingRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || isSubmittingRef.current) return;

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const redirectTo = getAuthRedirectUrl("reset-password");

      // Attempt to send password reset via serverless API
      let apiSuccess = false;
      try {
        const response = await fetch("/api/public/send-password-reset", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: trimmedEmail,
            redirectTo
          })
        });

        const resData = await response.json().catch(() => ({}));

        if (response.ok) {
          apiSuccess = true;
        } else if (response.status === 400) {
          setError(resData.error || "Please enter a valid email address.");
          setLoading(false);
          isSubmittingRef.current = false;
          return;
        } else if (response.status === 429) {
          setError("Too many password reset attempts. Please wait and try again later.");
          setLoading(false);
          isSubmittingRef.current = false;
          return;
        } else {
          console.warn("Serverless reset response notice:", response.status, resData);
        }
      } catch (apiErr) {
        console.warn("Serverless password reset endpoint call failed, falling back to client reset:", apiErr);
      }

      // Fallback to client-side Supabase auth reset if serverless API call didn't succeed
      if (!apiSuccess) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, { redirectTo });
        if (resetError) {
          console.warn("Client fallback reset error:", resetError.message);
        }
      }

      setRequestSent(true);
    } catch (err) {
      console.error("Forgot password request failed:", err);
      setError("Unable to send password reset request right now. Please try again.");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return <div className="min-h-screen bg-gray-50">
      <div className="w-full py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="w-full flex flex-col justify-center">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mb-6 inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Landing Page
              </button>

              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Reset your password
              </h1>

              <p className="text-lg text-gray-600 leading-relaxed">
                Enter your registered email address to receive a secure password reset link.
              </p>

              <div className="mt-10 relative h-64 hidden md:block">
                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-100 rounded-full opacity-60" />
                <div className="absolute top-12 left-24 w-40 h-40 bg-emerald-200 rounded-full opacity-40" />
                <div className="absolute bottom-0 left-12 w-24 h-24 bg-emerald-300 rounded-full opacity-50" />
              </div>
            </div>

            <div className="w-full flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md border border-gray-200"
              >
                {!requestSent ? <>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-emerald-50 rounded-lg">
                        <Mail className="w-6 h-6 text-emerald-600" />
                      </div>
                      <h2 className="text-3xl font-bold text-gray-900">
                        Forgot Password
                      </h2>
                    </div>

                    <p className="text-gray-600 mb-6">
                      Enter your registered email and we'll send a reset link.
                    </p>

                    {error && <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
                      >
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-red-600 text-sm">{error}</p>
                      </motion.div>}

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setError("");
                          }}
                          placeholder="Enter your registered email"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-all disabled:bg-emerald-400 disabled:cursor-not-allowed"
                      >
                        {loading ? <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Sending...
                          </span> : "Request Password Reset"}
                      </button>

                      <div className="text-center">
                        <Link
                          to="/login"
                          className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back to Login
                        </Link>
                      </div>
                    </form>
                  </> : <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, type: "spring" }}
                  >
                    <div className="text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-6"
                      >
                        <CheckCircle className="w-8 h-8 text-emerald-600" />
                      </motion.div>

                      <h2 className="text-3xl font-bold text-gray-900 mb-4">
                        Check Your Email
                      </h2>

                      <p className="text-gray-600 mb-6 leading-relaxed">
                        If an account with that email exists, a password reset link has been sent. Please check your inbox (and spam folder).
                      </p>

                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-emerald-800">
                          Click the link in the email to securely reset your password. The link will expire in 1 hour.
                        </p>
                      </div>

                      <Link
                        to="/login"
                        className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Login
                      </Link>
                    </div>
                  </motion.div>}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>;
}

export {
  ForgotPassword
};
