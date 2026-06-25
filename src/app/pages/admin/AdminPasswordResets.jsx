import { useEffect, useState } from "react";
import { AdminSidebar } from "../../components/AdminSidebar";
import { supabase, supabaseAdmin } from "../../lib/supabaseClient";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";
import { useActivity } from "../../lib/ActivityContext";
import { Key, ShieldAlert, CheckCircle2, Loader2, X, AlertTriangle, User, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const db = supabaseAdmin || supabase;

const generateTempPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export const AdminPasswordResets = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { trackActivity } = useActivity();
  
  const [showModal, setShowModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [tempPassword, setTempPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceChange, setForceChange] = useState(true);

  // For Admin Sidebar
  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState(adminNotifications);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const rawUser = localStorage.getItem("currentUser");
        if (rawUser) {
          const user = JSON.parse(rawUser);
          setAdminName(user.name || "Administrator");
        }
      } catch (err) {
        console.error("Error fetching admin data:", err);
      }
    };
    fetchAdminData();
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await db
        .from("password_reset_requests")
        .select("id, user_id, email, role, status, created_at, profiles(first_name, last_name)")
        .order("created_at", { ascending: false });

      if (err) throw err;
      
      setRequests(data || []);
    } catch (err) {
      setError("Failed to fetch password reset requests.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const openResetModal = (req) => {
    setSelectedRequest(req);
    setTempPassword(generateTempPassword());
    setForceChange(true);
    setShowModal(true);
  };

  const submitReset = async () => {
    if (!selectedRequest || !selectedRequest.user_id) {
      toast.error("Cannot reset: Missing user record.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (!supabaseAdmin) {
        throw new Error("Missing Supabase Admin privileges. Check VITE_SUPABASE_SERVICE_ROLE_KEY.");
      }

      // 1. Update user password via Admin Auth API
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        selectedRequest.user_id,
        { password: tempPassword }
      );
      if (updateAuthError) throw updateAuthError;

      // 2. Mark profile as needing password change
      const { error: profileError } = await db
        .from("profiles")
        .update({
          must_change_password: forceChange,
          last_password_reset: new Date().toISOString()
        })
        .eq("id", selectedRequest.user_id);
      if (profileError) throw profileError;

      // 3. Mark request as Completed
      const { error: reqError } = await db
        .from("password_reset_requests")
        .update({ status: "Completed" })
        .eq("id", selectedRequest.id);
      if (reqError) throw reqError;

      // 4. Log the action
      await db.from("password_reset_logs").insert({
        user_id: selectedRequest.user_id,
        temporary_password_generated: true,
      });

      // 5. Create notification for the user
      await db.from("notifications").insert({
        user_id: selectedRequest.user_id,
        title: "Password Reset Complete",
        message: "Your password was reset by an administrator.",
        type: "system"
      });

      trackActivity("Password Reset", "Admin fulfilled a password reset request.");
      toast.success("Password reset successfully. The temporary password is: " + tempPassword);
      
      setShowModal(false);
      fetchRequests();
    } catch (err) {
      console.error("Reset Error:", err);
      toast.error("Failed to reset password: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const { error: rejectError } = await db
        .from("password_reset_requests")
        .update({ status: "Rejected" })
        .eq("id", requestId);
        
      if (rejectError) throw rejectError;
      
      toast.success("Request rejected and dismissed.");
      fetchRequests();
    } catch (err) {
      console.error("Reject Error:", err);
      toast.error("Failed to reject request: " + err.message);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 h-screen overflow-y-auto lg:pl-64">
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4 flex justify-end">
            <NotificationDropdown
              notifications={notificationList}
              onMarkAsRead={() => {}}
              onNotificationsChange={setNotificationList}
            />
          </div>
        </div>

        <div className="p-6 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Password Resets</h1>
              <p className="text-gray-500">Manage user password reset requests.</p>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-20">
                <ShieldAlert className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No password reset requests found.</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Requested By</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Role</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Status</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Date</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map(req => (
                    <tr key={req.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {req.profiles?.first_name ? `${req.profiles.first_name} ${req.profiles.last_name || ""}` : "Unknown User"}
                          </span>
                          <span className="text-sm text-gray-500">{req.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize text-gray-700">{req.role}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${req.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {req.status === 'Pending' && (
                          <div className="flex justify-end items-center gap-2">
                            <button
                              onClick={() => handleRejectRequest(req.id)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                              title="Dismiss invalid request"
                            >
                              <Trash2 className="w-4 h-4" />
                              Reject
                            </button>
                            {req.user_id && (
                              <button
                                onClick={() => openResetModal(req)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors"
                              >
                                <Key className="w-4 h-4" />
                                Reset Password
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Reset Modal */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Key className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Fulfill Reset Request</h3>
                  <p className="text-sm text-gray-500">Generate a temporary password</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Target Account</p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-600" />
                  <p className="font-medium text-gray-900">{selectedRequest.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Generated Password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempPassword}
                    readOnly
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => setTempPassword(generateTempPassword())}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                  >
                    Regenerate
                  </button>
                </div>
                <p className="mt-2 text-sm text-amber-600">
                  Please securely communicate this password to the user.
                </p>
              </div>

              <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={forceChange}
                  onChange={(e) => setForceChange(e.target.checked)}
                  className="w-5 h-5 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
                />
                <div>
                  <p className="font-medium text-gray-900">Force Password Change</p>
                  <p className="text-sm text-gray-500">User must change password on next login</p>
                </div>
              </label>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitReset}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm & Reset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
