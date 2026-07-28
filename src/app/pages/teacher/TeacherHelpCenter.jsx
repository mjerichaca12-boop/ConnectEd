import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TeacherSidebar } from "@/app/components/TeacherSidebar";
import { NotificationDropdown } from "@/app/components/NotificationDropdown";
import { useTeacherTour } from "@/app/context/TeacherTourContext";
import { useModuleTour } from "@/app/context/ModuleTourContext";
import {
  HelpCircle,
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  MessageSquare,
  Sparkles,
  User,
  Megaphone,
  Mail,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ExternalLink,
  LifeBuoy,
  Play,
  RotateCcw,
  PlayCircle,
  Search,
} from "lucide-react";

export function TeacherHelpCenter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isFromOnboarding = searchParams.get("fromOnboarding") === "true";
  const { restartTour, tourStatus } = useTeacherTour();
  const { getModuleProgress, handleModuleCardClick } = useModuleTour();
  const [teacherName] = useState(() => {
    const rawUser = localStorage.getItem("currentUser");
    if (rawUser) {
      try {
        const user = JSON.parse(rawUser);
        return user.name || "Teacher";
      } catch {
        return "Teacher";
      }
    }
    return "Teacher";
  });

  const [notificationList, setNotificationList] = useState([]);
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      question: "How do I view my assigned classes and student rosters?",
      answer: "Click 'Classes' in the sidebar to inspect all your assigned subject sections. Select any class to view enrolled students, manage class rosters, and access learning materials.",
    },
    {
      question: "How do I record written work, performance tasks, and quarterly grades?",
      answer: "Navigate to 'Grades Management' from the sidebar. Select your subject and section to enter student scores for Written Work, Performance Tasks, and Quarterly Assessments.",
    },
    {
      question: "How does automatic DepEd grade transmutation work?",
      answer: "The ConnectEd Gradebook applies official DepEd transmutation tables automatically to raw scores, computing final quarterly grades accurately for all enrolled students.",
    },
    {
      question: "How do I generate lesson plans using the AI Teaching Assistant?",
      answer: "Go to 'AI Assistant' from the sidebar. Enter your subject topic, grade level, and learning objectives to generate curriculum-aligned lesson plans, quiz questions, and rubrics in seconds.",
    },
    {
      question: "How do I message students and answer inquiries?",
      answer: "Click 'Messages' in the sidebar to open direct chat channels with students and school administrators. Unread message counts update in real time.",
    },
    {
      question: "How do I restart the Teacher Guided Tour?",
      answer: "Click the 'Restart Teacher Tour' button at the top of this Help Center page to re-run the 11-step interactive guided tour through all teacher features.",
    },
  ];

  const userGuides = [
    {
      moduleId: "teacher-dashboard",
      icon: LayoutDashboard,
      title: "Dashboard Overview",
      description: "View active school year, current quarter, daily teaching tasks, enrolled student totals, and recent grades.",
    },
    {
      moduleId: "classes",
      icon: BookOpen,
      title: "Classes Overview",
      description: "Inspect assigned subjects, section rosters, student profiles, and class learning materials.",
    },
    {
      moduleId: "grades",
      icon: ClipboardList,
      title: "Grades Management",
      description: "Encode raw student assessment scores, compute DepEd transmuted grades, and review academic performance.",
    },
    {
      moduleId: "teacher-messages",
      icon: MessageSquare,
      title: "Direct Messages",
      description: "Communicate directly with students, answer academic inquiries, and receive administrative notices.",
    },
    {
      moduleId: "ai-assistant",
      icon: Sparkles,
      title: "AI Teaching Assistant",
      description: "Generate lesson plans, quiz items, rubrics, and interactive classroom activities tailored for Junior High School.",
    },
    {
      moduleId: "teacher-profile",
      icon: User,
      title: "Profile & Account Security",
      description: "Update contact phone numbers, upload profile avatar photos, and manage login password security.",
    },
  ];

  const filteredGuides = userGuides.filter(
    (g) =>
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFaqs = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex relative overflow-hidden font-sans">
      {/* Subtle Background Glow Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-green-100/50 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-50/50 rounded-full blur-[120px]" />
      </div>

      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

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
                  Teacher Help Center &amp; Support
                </h1>
                <p className="text-gray-500 text-xs mt-1">
                  ConnectED Teacher Onboarding, Interactive Guides &amp; Help Resources
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
          {/* Onboarding Welcome Notice (Only shown when coming from First Login Onboarding) */}
          {isFromOnboarding && (
            <div className="bg-gradient-to-r from-green-500/10 via-teal-500/10 to-emerald-500/10 border border-green-200 rounded-2xl p-5 flex items-center justify-between gap-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-md">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">Welcome to Teacher Help Center!</h4>
                  <p className="text-gray-600 text-xs mt-0.5">
                    Explore the <strong>User Guide &amp; Key Modules</strong> below to start interactive guided tours for any platform feature.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Search Filter Bar */}
          <div className="relative">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help topics, module guides, and FAQs..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all shadow-sm"
            />
          </div>

          {/* User Guide Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-bold text-gray-900">User Guide &amp; Key Modules</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGuides.map((guide, idx) => {
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
                          type="button"
                          onClick={() => handleModuleCardClick(guide.moduleId, navigate)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 hover:bg-emerald-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Replay Tour</span>
                        </button>
                      )}
                      {status === "in_progress" && (
                        <button
                          type="button"
                          onClick={() => handleModuleCardClick(guide.moduleId, navigate)}
                          className="px-4 py-2 bg-amber-600 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 hover:bg-amber-700 active:scale-95 transition-all shadow-xs cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Continue Tour</span>
                        </button>
                      )}
                      {status === "not_started" && (
                        <button
                          type="button"
                          onClick={() => handleModuleCardClick(guide.moduleId, navigate)}
                          className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 hover:from-green-700 hover:to-teal-700 active:scale-95 transition-all shadow-md cursor-pointer animate-pulse ring-2 ring-green-400/80 shadow-green-600/30 hover:animate-none"
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
              {filteredFaqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={idx} className="transition-colors">
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50/80 transition-colors cursor-pointer"
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

export default TeacherHelpCenter;
