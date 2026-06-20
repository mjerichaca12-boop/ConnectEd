import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { getAuthRedirectUrl, supabase } from "../lib/supabaseClient";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim()) || String(value || "").trim().endsWith(".local");

  const sendResetRequest = async () => {
    if (!supabase) {
      throw new Error("Service is not configured. Please try again later.");
    }

    // Attempt to lookup user ID
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.trim())
      .eq('role', role)
      .maybeSingle();
      
    if (profileError) throw profileError;

    const { error: insertError } = await supabase
      .from('password_reset_requests')
      .insert({
        user_id: userProfile?.id || null,
        email: email.trim(),
        role: role,
        status: 'Pending'
      });

    if (insertError) throw insertError;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await sendResetRequest();
      setRequestSent(true);
    } catch (err) {
      console.error("Forgot password request failed:", err);
      setError("Unable to send request right now. Please try again.");
    } finally {
      setLoading(false);
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
                Please contact the administrator to reset your password. Submit a request below.
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
                      Submit a password reset request to your system administrator.
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Account Type
                        </label>
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                          {role === 'student' ? 'Student Email' : 'Teacher Email'}
                        </label>
                        <input
                          type="text"
                          id="email"
                          name="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setError("");
                          }}
                          placeholder={`Enter your ${role} email`}
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
                        Request Submitted
                      </h2>

                      <p className="text-gray-600 mb-6 leading-relaxed">
                        Your request has been submitted successfully. Please wait for administrator approval.
                      </p>

                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-emerald-800">
                          The administrator will generate a temporary password for you. Check back later or contact your school administration.
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
