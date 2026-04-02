import { useState, useEffect } from "react";
import { AdminSidebar } from "../../components/AdminSidebar";
import { useNavigate } from "react-router-dom";
import { Calendar as CalendarIcon, Plus, Edit2, Trash2 } from "lucide-react";
import { DashboardCalendar } from "../../components/DashboardCalendar";
import { NotificationDropdown } from "../../components/NotificationDropdown";
import { adminNotifications } from "../../components/NotificationDefault";

export function AdminCalendar() {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("");
  const [notificationList, setNotificationList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mock list of events that admin can edit
  const [events, setEvents] = useState([
    { id: 1, name: "Mid-term Exams", date: "Jan 20 - Jan 24", type: "academic" },
    { id: 2, name: "Sports Festival", date: "Feb 15 - Feb 18", type: "event" },
  ]);

  useEffect(() => {
    const userData = localStorage.getItem("currentUser");
    if (!userData) {
      navigate("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== "admin") {
      navigate("/login");
      return;
    }
    setAdminName(user.name);
    setTimeout(() => setLoading(false), 800);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleAddEvent = () => {
    // In a real app this would open a modal to add an event
    const newEvent = {
        id: Date.now(),
        name: "New School Activity",
        date: "TBD",
        type: "event",
    };
    setEvents([...events, newEvent]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{animationDelay:'0ms'}} />
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:'150ms'}} />
            <div className="w-3 h-3 rounded-full bg-red-500 animate-bounce" style={{animationDelay:'300ms'}} />
          </div>
          <p className="text-gray-500">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />
      <div className="hidden lg:block w-72 flex-shrink-0" />

      <main className="flex-1 overflow-y-auto scrollbar-hide relative z-10">
        {/* Top Bar */}
        <div className="bg-gray-950/80 backdrop-blur-md border-b border-white/8 sticky top-0 z-20 relative">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-widest">Admin Portal</p>
                <h2 className="text-lg font-bold text-white">Manage School Calendar</h2>
              </div>
              <NotificationDropdown
                notifications={notificationList}
                onMarkAsRead={(id) =>
                  setNotificationList((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
                }
                onNotificationsChange={setNotificationList}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Calendar Preview */}
            <div className="w-full md:w-1/3">
              <DashboardCalendar />
            </div>

            {/* Event Management */}
            <div className="w-full md:w-2/3 bg-gray-900/60 rounded-xl shadow-sm border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-emerald-400" />
                  School Events & Holidays
                </h3>
                <button
                  onClick={handleAddEvent}
                  className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-500 transition-colors flex items-center gap-2 text-sm shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Add Event
                </button>
              </div>

              <div className="p-6">
                <p className="text-sm text-gray-400 mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
                  Manage the official school calendar. Changes made here will instantly reflect on both Student and Teacher dashboards.
                </p>

                <div className="space-y-4">
                  {events.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{evt.name}</span>
                        <span className="text-sm text-emerald-400 mt-1">{evt.date}</span>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 text-emerald-400 hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-red-400 hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                          title="Delete"
                          onClick={() => setEvents(events.filter(e => e.id !== evt.id))}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {events.length === 0 && (
                    <div className="text-center py-8 text-gray-500 bg-white/5 rounded-xl border border-white/5">
                      No events registered.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
