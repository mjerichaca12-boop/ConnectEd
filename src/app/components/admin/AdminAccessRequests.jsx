import { useEffect, useState } from "react";
import { Mail, CheckCircle, XCircle, Clock, Send } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

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
  // Try new schema first (split names)
  const newSchemaName = [request.first_name, request.middle_name, request.last_name].filter(Boolean).join(" ").trim();
  if (newSchemaName) return newSchemaName;

  // Fallback to old schema (single name field)
  return String(request.name || "").trim();
};

function AdminAccessRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("all");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadingApproveId, setLoadingApproveId] = useState(null);
  const [loadingDeclineId, setLoadingDeclineId] = useState(null);

  useEffect(() => {
    loadAccessRequests();
  }, []);

  const loadAccessRequests = async () => {
    try {
      setLoading(true);
      setLoadError("");
      const { data, error } = await supabase.functions.invoke("admin-access-requests", {
        body: { action: "list" }
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || "Failed to load access requests.");

      setRequests(data.requests || []);
    } catch (err) {
      console.error("Failed to load access requests:", err);
      setLoadError(err instanceof Error ? err.message : "Failed to load access requests.");
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    if (filter === "all") return true;
    return req.status === filter;
  });

  const handleApproveAndSendInvite = async (request) => {
    if (!supabase) return;

    setLoadingApproveId(request.id);
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

      setTimeout(() => setActionMessage(""), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred.";
      setActionError(errorMsg);
    } finally {
      setLoadingApproveId(null);
    }
  };

  const handleDeclineRequest = async (request) => {
    if (!supabase) return;

    setLoadingDeclineId(request.id);
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

      setTimeout(() => setActionMessage(""), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred.";
      setActionError(errorMsg);
    } finally {
      setLoadingDeclineId(null);
    }
  };

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          {loadError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Teacher Access Requests</h2>
        <button
          onClick={loadAccessRequests}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Messages */}
      {actionMessage && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-300 text-green-300 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          {actionError}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200/80 pb-3">
        {["all", "pending", "approved", "rejected", "invited"].map((status) => {
          const isActive = filter === status;
          const count = requests.filter((r) => r.status === (status === "all" ? undefined : status) || status === "all").length;
          const tabIcons = {
            pending: Clock,
            approved: CheckCircle,
            rejected: XCircle,
            invited: Send,
            all: Mail
          };
          const IconComponent = tabIcons[status];
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer
                ${isActive
                  ? "bg-gray-100 text-green-600 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
            >
              <IconComponent className={`w-4 h-4 ${isActive ? "text-green-600" : "text-gray-400"}`} />
              <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors
                ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {count}
              </span>
            </button>
          );
        })}
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
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-gray-700 font-semibold">Email</th>
                <th className="px-6 py-3 text-left text-gray-700 font-semibold">Name</th>
                <th className="px-6 py-3 text-left text-gray-700 font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-gray-700 font-semibold">Requested</th>
                <th className="px-6 py-3 text-right text-gray-700 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-6 py-3 text-gray-700">{request.email}</td>
                  <td className="px-6 py-3 text-gray-700">{getRequestFullName(request)}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600 text-xs">
                    {new Date(request.requested_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {request.status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleApproveAndSendInvite(request); }}
                            disabled={loadingApproveId === request.id}
                            className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50 text-sm font-medium"
                            title="Approve request"
                          >
                            {loadingApproveId === request.id ? "Approving..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeclineRequest(request); }}
                            disabled={loadingDeclineId === request.id}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 text-sm font-medium"
                            title="Decline request"
                          >
                            {loadingDeclineId === request.id ? "Declining..." : "Decline"}
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
  );
}

export { AdminAccessRequests };
