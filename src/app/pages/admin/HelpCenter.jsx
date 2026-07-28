import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminSidebar } from "@/app/components/AdminSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { adminNotifications } from "@/app/components/NotificationDefault";
import { useTour } from "@/app/context/TourContext";
import { useModuleTour } from "@/app/context/ModuleTourContext";
import {
  HelpCircle,
  LayoutDashboard,
  PlayCircle,
  BookOpen,
  MessageSquare,
  Mail,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Users,
  UserCog,
  Calendar,
  Settings,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  LifeBuoy,
  Play,
  RotateCcw,
} from "lucide-react";

export function HelpCenter() {
  const navigate = useNavigate();
  const { restartTour } = useTour();
  const { getModuleProgress, handleModuleCardClick } = useModuleTour();
  const [adminName] = useState(() => {
    const rawUser = localStorage.getItem("currentUser");
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser);
        return user.name || "Administrator";
      } catch {
        return "Administrator";
      }
    }
    return "Administrator";
  });

  const [notificationList, setNotificationList] = useState(adminNotifications);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const handleStartTourClick = () => {
    restartTour(navigate);
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  const faqs = [
    {
      question: "How do I create and manage student accounts?",
      answer: "Go to Student Management from the sidebar. Click 'Add Student' to register new student accounts, assign section enrollment, or edit existing student records.",
    },
    {
      question: "How do I assign teachers to specific subjects and sections?",
      answer: "Navigate to Teacher Management or Subject Management. Select a teacher or subject, then map them to designated class sections using the assignment configuration controls.",
    },
    {
      question: "How do I configure grade levels, sections, and active school years?",
      answer: "Go to Academic Settings in the sidebar to set up active school years, current quarter terms, grade levels, and class section limits.",
    },
    {
      question: "How do I publish school announcements?",
      answer: "Open Announcements from the sidebar. Create a new announcement, set its title and visibility, and broadcast it to teachers, students, or all users.",
    },

    {
      question: "How do I restart the Administrator Guided Tour?",
      answer: "You can click the 'Restart Admin Tour' button at the top of this Help Center page to re-run the 12-step guided tour through all sidebar modules.",
    },
  ];

  const userGuides = [
    {
      moduleId: "dashboard",
      icon: LayoutDashboard,
      title: "Dashboard Overview",
      description: "Monitor real-time school KPIs, student & teacher counts, system activity logs, and pending password resets.",
    },
    {
      moduleId: "students",
      icon: Users,
      title: "Student Management",
      description: "Register new students, verify LRN records, assign sections, and update student profiles.",
    },
    {
      moduleId: "teachers",
      icon: UserCog,
      title: "Teacher Management",
      description: "Manage teacher profiles, assign subjects and sections, and monitor faculty workloads.",
    },
    {
      moduleId: "subjects",
      icon: BookOpen,
      title: "Subject Management",
      description: "Create subject codes, set up course descriptions, and map curriculum requirements.",
    },
    {
      moduleId: "announcements",
      icon: FileText,
      title: "Announcements & Broadcasts",
      description: "Publish school-wide updates and official notices visible to teachers and students.",
    },

    {
      moduleId: "calendar",
      icon: Calendar,
      title: "School Calendar",
      description: "Schedule academic events, examination schedules, and official school holidays.",
    },
    {
      moduleId: "academic-settings",
      icon: Settings,
      title: "Academic Settings",
      description: "Configure grade levels, class sections, active school years, and quarter terms.",
    },
    {
      moduleId: "messages",
      icon: MessageSquare,
      title: "Messages & Support",
      description: "Communicate directly with teachers, students, and system administrators.",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden">
      {/* Subtle Background Glow Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-100/50 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-50/50 rounded-full blur-[120px]" />
      </div>

      <AdminSidebar adminName={adminName} onLogout={handleLogout} />

      <main className="flex-1 h-screen overflow-y-auto lg:pl-64 z-10">
        {/* Top Header Bar */}
        <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-20 shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-100">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-none">
                  Help Center &amp; Support
                </h1>
                <p className="text-gray-500 text-xs mt-1">
                  ConnectED Administrator Onboarding, Guides &amp; Help Resources
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <NotificationDropdown
                notifications={notificationList}
                onMarkAsRead={(id) =>
                  setNotificationList((prev) =>
                    prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
                  )
                }
                onNotificationsChange={setNotificationList}
              />
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-8 max-w-6xl mx-auto">
          {/* Hero Banner: Interactive Guided Tour */}
          <div className="relative bg-gradient-to-r from-green-600 via-teal-600 to-blue-600 rounded-3xl p-8 text-white shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold tracking-wide">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Admin Onboarding</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Interactive Guided Tour
                </h2>
                <p className="text-green-50 text-sm leading-relaxed">
                  Need a refresher on ConnectED modules? The guided walkthrough highlights system features step-by-step.
                </p>
              </div>
            </div>
          </div>

          {/* User Guide Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-bold text-gray-900">User Guide &amp; Key Modules</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userGuides.map((guide, idx) => {
                const IconComponent = guide.icon;
                const progress = getModuleProgress(guide.moduleId);
                const status = progress.status;

                return (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center text-green-600">
                          <IconComponent className="w-5 h-5" />
                        </div>

                        {/* Learning Status Badge */}
                        {status === "completed" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Completed
                          </span>
                        )}
                        {status === "in_progress" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            In Progress (Step {progress.lastStepIndex + 1}/{progress.totalSteps})
                          </span>
                        )}
                        {status === "not_started" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                            Not Started
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-gray-900 text-base">{guide.title}</h4>
                      <p className="text-gray-600 text-xs leading-relaxed">{guide.description}</p>
                    </div>

                    <div className="pt-4 mt-3 border-t border-gray-100 flex items-center justify-between">
                      {status === "completed" && (
                        <button
                          onClick={() => handleModuleCardClick(guide.moduleId, navigate)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 hover:bg-emerald-700 active:scale-95 transition-all shadow-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Replay Tour</span>
                        </button>
                      )}
                      {status === "in_progress" && (
                        <button
                          onClick={() => handleModuleCardClick(guide.moduleId, navigate)}
                          className="px-4 py-2 bg-amber-600 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 hover:bg-amber-700 active:scale-95 transition-all shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Continue Tour</span>
                        </button>
                      )}
                      {status === "not_started" && (
                        <button
                          onClick={() => handleModuleCardClick(guide.moduleId, navigate)}
                          className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 hover:from-green-700 hover:to-teal-700 active:scale-95 transition-all shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Start Tour</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Frequently Asked Questions */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-bold text-gray-900">Frequently Asked Questions</h3>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={idx} className="transition-colors">
                    <button
                      onClick={() => toggleFaq(idx)}
                      className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50/80 transition-colors"
                    >
                      <span className="font-semibold text-gray-900 text-sm">{faq.question}</span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-green-600 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-5 pt-1 text-gray-600 text-xs leading-relaxed bg-gray-50/50">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact Support */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-bold text-gray-900">Contact Support</h3>
            </div>
            <p className="text-gray-600 text-xs leading-relaxed">
              If you require technical assistance or system maintenance support, reach out to the ConnectED Technical Operations team:
            </p>

            <div className="pt-2">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100 max-w-md">
                <div className="p-2.5 bg-green-100 text-green-700 rounded-xl">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Email Support</p>
                  <p className="text-sm font-bold text-gray-900">support@connected.deped.gov.ph</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
