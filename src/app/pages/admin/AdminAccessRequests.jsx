import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { Mail, CheckCircle, XCircle, Clock, Send } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

const ACCESS_REQUEST_REFRESH_KEY = "connected_access_requests_refresh";

const normalizeStatus = (status) => {
  const value = String(status || "").trim().toLowerCase();
  if (["pending", "for_approval", "waiting", "awaiting_approval", "awaiting approval"].includes(value)) return "pending";
  if (["approved", "approve", "accepted", "active", "verified"].includes(value)) return "approved";
  if (["rejected", "reject", "declined", "denied"].includes(value)) return "rejected";
  if (["invited", "invite_sent", "sent"].includes(value)) return "invited";
  return value || "pending";
};

const getCurrentAdminSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
};

const getStatusColor = (status) => {
  switch (status) {
    case "pending":
      return "bg-yellow-500/10 text-yellow-300 border-yellow-500/30";
    case "approved":
    case "invited":
      return "bg-green-50 text-green-300 border-green-300";
    case "rejected":
      return "bg-red-50 text-red-300 border-red-500/30";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-500/30";
  }
};

const getStatusIcon = (status) => {
  switch (status) {
    case "pending":
      return <Clock className="w-4 h-4" />;
    case "approved":
    case "invited":
      return <CheckCircle className="w-4 h-4" />;
    case "rejected":
      return <XCircle className="w-4 h-4" />;
    default:
      return null;
  }
};

const getRequestFullName = (request) => {
  const fullName = String(request.full_name || "").trim();
  if (fullName) return fullName;

  // Try new schema first (split names)
  const newSchemaName = [request.first_name, request.middle_name, request.last_name].filter(Boolean).join(" ").trim();
  if (newSchemaName) return newSchemaName;
  
  // Fallback to old schema (single name field)
  return String(request.name || "").trim();
};

const getRequestTimestamp = (request) => {
  return request.requested_at || request.created_at || request.updated_at || "";
};

function AdminAccessRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("pending");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadingId, setLoadingId] = useState(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    loadAccessRequests();
    const refreshChannel = supabase.channel("teacher_access_requests_changes");
    const requestTables = ["teacher_access_request", "teacher_request_access", "teacher_access_requests"];

    requestTables.forEach((table) => {
      refreshChannel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        loadAccessRequests();
      });
    });

    refreshChannel.subscribe();

    const handleRefreshSignal = () => {
      loadAccessRequests();
    };

    const handleStorage = (event) => {
      if (event.key === ACCESS_REQUEST_REFRESH_KEY) {
        loadAccessRequests();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("connected:access-requests-updated", handleRefreshSignal);

    return () => {
      supabase.removeChannel(refreshChannel);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("connected:access-requests-updated", handleRefreshSignal);
    };
  }, []);

  const loadAccessRequests = async () => {
    try {
      const currentAdmin = await getCurrentAdminSession();
      console.log("[AdminAccessRequests] current admin session:", currentAdmin);
      console.log("[AdminAccessRequests] invoking function: admin-access-requests");
      console.log("[AdminAccessRequests] request payload:", { action: "list" });

      setLoading(true);
      setLoadError("");
      const { data, error } = await supabase.functions.invoke("admin-access-requests", {
        body: { action: "list" }
      });

      console.log("[AdminAccessRequests] function response:", data);

      if (error) {
        console.error("[AdminAccessRequests] Supabase function error:", error);
        throw error;
      }
      if (!data?.ok) throw new Error(data?.message || "Failed to load access requests.");

      const fetchedRequests = Array.isArray(data.requests) ? data.requests : [];
      console.log("[AdminAccessRequests] fetched requests:", fetchedRequests);
      console.log("[AdminAccessRequests] request count:", fetchedRequests.length);
      console.log("[AdminAccessRequests] fetched status values:", fetchedRequests.map((request) => request.status));

      setRequests(
        fetchedRequests.map((request) => ({
          ...request,
          status: normalizeStatus(request.status),
          requested_at: request.requested_at || request.created_at || request.updated_at || null
        }))
      );
    } catch (err) {
      console.error("Failed to load access requests:", err);
      setLoadError(err instanceof Error ? err.message : "Failed to load access requests.");
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    if (filter === "all") return true;
    return normalizeStatus(req.status) === filter;
  });

  const handleApproveAndSendInvite = async (request) => {
    if (!supabase) return;

    setLoadingId(request.id);
    setActionError("");
    setActionMessage("");

    try {
      const { data, error: updateError } = await supabase.functions.invoke("admin-access-requests", {
        body: {
          action: "approve",
          id: request.id,
          reviewedBy: "admin"
        }
      });

      if (updateError) throw updateError;
      if (!data?.ok) throw new Error(data?.message || "Failed to approve request.");

      const { data: invitationData, error: invitationError } = await supabase.functions.invoke("send-invitation", {
        body: {
          requestId: request.id,
          email: request.email,
          name: getRequestFullName(request),
          adminId: "admin"
        }
      });

      if (invitationError) throw invitationError;
      if (!invitationData?.ok) {
        throw new Error(invitationData?.message || "Failed to send invitation.");
      }

      setActionMessage(`Approved and invitation sent to ${request.email}`);
      await loadAccessRequests();

      setTimeout(() => setActionMessage(""), 4000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred.";
      setActionError(errorMsg);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeclineRequest = async (request) => {
    if (!supabase) return;

    setLoadingId(request.id);
    setActionError("");
    setActionMessage("");

    try {
      const { data, error } = await supabase.functions.invoke("admin-access-requests", {
        body: {
          action: "reject",
          id: request.id,
          reviewedBy: "admin"
        }
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || "Failed to decline request.");

      setActionMessage(`Request from ${request.email} declined.`);
      await loadAccessRequests();

      setTimeout(() => setActionMessage(""), 4000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred.";
      setActionError(errorMsg);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-x-hidden">
      <AdminSidebar adminName="Admin" onLogout={handleLogout} />

      <main className="flex-1 min-w-0 overflow-hidden flex flex-col lg:pl-64">
        {/* Top Bar */}
        <div className="bg-gray-50 border-b border-gray-200 z-20 sticky top-0 backdrop-blur-sm">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Teacher Access Requests</h2>
              <button
                onClick={loadAccessRequests}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-gray-900 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 sm:p-6 lg:p-8">
          {loadError && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {/* Messages */}
          {actionMessage && (
            <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-300 text-green-300 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {actionMessage}
            </div>
          )}
          {actionError && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {actionError}
            </div>
          )}

          {/* Filter Tabs */}
          <div className="mb-6 flex gap-2 border-b border-gray-200 pb-0">
            {["pending", "approved", "rejected", "invited", "all"].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  filter === status
                    ? "text-green-600 border-green-400"
                    : "text-gray-600 border-transparent hover:text-gray-700"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-2 text-xs">
                  ({requests.filter((r) => status === "all" || normalizeStatus(r.status) === status).length})
                </span>
              </button>
            ))}
          </div>

          {/* Requests Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Loading requests...</p>
              </div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-500">No access requests found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white/30">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-gray-700 font-semibold">Email</th>
                    <th className="px-6 py-4 text-left text-gray-700 font-semibold">Name</th>
                    <th className="px-6 py-4 text-left text-gray-700 font-semibold">Status</th>
                    <th className="px-6 py-4 text-left text-gray-700 font-semibold">Requested</th>
                    <th className="px-6 py-4 text-right text-gray-700 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-white/2 transition-colors">
                      <td className="px-6 py-4 text-gray-700">{request.email}</td>
                      <td className="px-6 py-4 text-gray-700">{getRequestFullName(request)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(request.status)}`}>
                          {getStatusIcon(request.status)}
                          {normalizeStatus(request.status).charAt(0).toUpperCase() + normalizeStatus(request.status).slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs">
                        {getRequestTimestamp(request) ? new Date(getRequestTimestamp(request)).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {request.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleApproveAndSendInvite(request)}
                                disabled={loadingId === request.id}
                                className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-gray-900 transition-colors disabled:opacity-50 text-sm font-medium"
                                title="Approve request"
                              >
                                {loadingId === request.id ? "Approving..." : "Approve"}
                              </button>
                              <button
                                onClick={() => handleDeclineRequest(request)}
                                disabled={loadingId === request.id}
                                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-gray-900 transition-colors disabled:opacity-50 text-sm font-medium"
                                title="Decline request"
                              >
                                {loadingId === request.id ? "Declining..." : "Decline"}
                              </button>
                            </>
                          )}
                          {request.status !== "pending" && (
                            <span className="text-xs text-gray-500">No actions available</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

    </div>
  );
}

export { AdminAccessRequests };
