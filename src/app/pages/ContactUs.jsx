import { useState, useRef, useEffect } from "react";
import { Navigation } from "../components/Navigation";
import { Footer } from "../components/Footer";
import {
  Mail,
  Send,
  CheckCircle2,
  Copy,
  Check,
  User,
  HelpCircle,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Clock,
  Zap,
  ChevronDown,
  Wrench,
  KeyRound,
  BookOpen,
} from "lucide-react";

const CATEGORY_OPTIONS = [
  {
    id: "Technical Support",
    label: "Technical Support & Portal Errors",
    icon: Wrench,
    desc: "Bug reports, system loading issues, platform errors",
  },
  {
    id: "Account Access",
    label: "Account Verification & Password Resets",
    icon: KeyRound,
    desc: "Unverified accounts, credentials, login assistance",
  },
  {
    id: "Grade System",
    label: "Gradebook & Academic Settings",
    icon: BookOpen,
    desc: "Transmutation tables, subject encoding, grading scale",
  },
  {
    id: "General Inquiry",
    label: "General Feedback & Assistance",
    icon: MessageSquare,
    desc: "Feature requests, general portal support, feedback",
  },
];

function ContactUs() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "Technical Support",
    subject: "",
    message: "",
  });

  const [status, setStatus] = useState("idle"); // idle, loading, success, error
  const [errorMessage, setErrorMessage] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryDropdownRef = useRef(null);

  const selectedCategoryObj =
    CATEGORY_OPTIONS.find((c) => c.id === formData.category) || CATEGORY_OPTIONS[0];
  const SelectedIcon = selectedCategoryObj.icon;

  // Close custom dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setIsCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectCategory = (catId) => {
    setFormData((prev) => ({ ...prev, category: catId }));
    setIsCategoryOpen(false);
  };

  const handleCopyEmail = (emailText) => {
    navigator.clipboard.writeText(emailText);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
      setStatus("error");
      setErrorMessage("Please complete all fields before sending your message.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      setStatus("error");
      setErrorMessage("Please provide a valid email address.");
      return;
    }

    setTimeout(() => {
      setStatus("success");
      setFormData({
        name: "",
        email: "",
        category: "Technical Support",
        subject: "",
        message: "",
      });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navigation />

      <main className="flex-grow pt-28 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header Banner */}
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-green-50 border border-green-200/80 text-green-700 text-xs font-bold tracking-wide uppercase mb-4 shadow-2xs">
              <Mail className="w-3.5 h-3.5 text-green-600" />
              <span>Official Email Support Hub</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
              How Can We Help You?
            </h1>
            <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              Have questions about student management, grading workflows, or school account access? Reach out to the ConnectEd support team via official email or fill out the inquiry form below.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Email Channels & SLAs (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Primary Email Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xl shadow-gray-200/50 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-green-500 to-teal-600 text-white rounded-2xl shadow-md shadow-green-600/20">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Direct Email Support</h2>
                    <p className="text-xs text-gray-500">Official Technical Channel</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Primary Email Box */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-3 group hover:border-green-200 transition-all">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                        General & Teacher Inquiries
                      </p>
                      <p className="text-sm font-extrabold text-gray-900 truncate">
                        support@connected.deped.gov.ph
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyEmail("support@connected.deped.gov.ph")}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-white rounded-xl border border-transparent hover:border-gray-200 transition-all focus:outline-none cursor-pointer"
                      title="Copy email address"
                    >
                      {copiedEmail ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Secondary Ops Email Box */}
                  <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-3 group hover:border-green-200 transition-all">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                        System Administration Ops
                      </p>
                      <p className="text-sm font-extrabold text-gray-900 truncate">
                        admin.ops@connected.deped.gov.ph
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyEmail("admin.ops@connected.deped.gov.ph")}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-white rounded-xl border border-transparent hover:border-gray-200 transition-all focus:outline-none cursor-pointer"
                      title="Copy email address"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Service Commitments */}
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-3 text-xs text-gray-600 font-medium">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                    <span><strong>24-48 Hours SLA:</strong> Rapid ticket resolution</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-600 font-medium">
                    <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
                    <span><strong>Verified Channel:</strong> Secure DepEd data processing</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-600 font-medium">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><strong>Operating Hours:</strong> Mon – Fri, 8:00 AM – 5:00 PM</span>
                  </div>
                </div>
              </div>

              {/* Support Tip Box */}
              <div className="bg-gradient-to-br from-green-900 to-teal-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">Need Immediate Portal Guidance?</h3>
                    <p className="text-xs text-green-100/80 leading-relaxed">
                      Check out our built-in Help Center in the Admin Portal for step-by-step interactive module tours and user guides.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Send Email Message Form (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-200/80 p-6 sm:p-8 md:p-10 shadow-xl shadow-gray-200/50">
              <div className="mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Send Support Email</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Fill out the details below to dispatch a message directly to our support queue.
                </p>
              </div>

              {status === "success" ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in-95">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Message Dispatched!</h3>
                  <p className="text-gray-600 text-xs sm:text-sm max-w-md leading-relaxed">
                    Thank you for reaching out. Your inquiry has been routed to our technical support team. A confirmation response will be sent to your email.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="mt-4 px-6 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-xs cursor-pointer"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {status === "error" && (
                    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-medium animate-in fade-in">
                      {errorMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-700">Full Name</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="e.g. Maria Santos"
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                        />
                      </div>
                    </div>

                    {/* Email Address */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-700">Email Address</label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="teacher@school.deped.gov.ph"
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custom Ultra-Premium Inquiry Category Dropdown */}
                  <div className="space-y-1.5 relative" ref={categoryDropdownRef}>
                    <label className="block text-xs font-bold text-gray-700">Inquiry Category</label>
                    
                    {/* Dropdown Trigger Button */}
                    <button
                      type="button"
                      onClick={() => setIsCategoryOpen((prev) => !prev)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border ${
                        isCategoryOpen ? "border-green-500 ring-2 ring-green-500/20 bg-white" : "border-gray-200 hover:border-gray-300"
                      } rounded-xl text-xs font-medium transition-all text-left cursor-pointer focus:outline-none`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1 bg-green-100/80 text-green-700 rounded-lg shrink-0">
                          <SelectedIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-gray-900 truncate">
                          {selectedCategoryObj.label}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                          isCategoryOpen ? "rotate-180 text-green-600" : ""
                        }`}
                      />
                    </button>

                    {/* Popover Menu */}
                    {isCategoryOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-gray-200/90 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                        <div className="space-y-1">
                          {CATEGORY_OPTIONS.map((cat) => {
                            const IconComp = cat.icon;
                            const isSelected = cat.id === formData.category;

                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleSelectCategory(cat.id)}
                                className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer group ${
                                  isSelected
                                    ? "bg-green-50 text-green-900 border border-green-200/80"
                                    : "hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-transparent"
                                }`}
                              >
                                <div
                                  className={`p-2 rounded-lg shrink-0 transition-colors ${
                                    isSelected
                                      ? "bg-green-600 text-white shadow-xs"
                                      : "bg-gray-100 text-gray-500 group-hover:bg-green-100 group-hover:text-green-700"
                                  }`}
                                >
                                  <IconComp className="w-4 h-4" />
                                </div>
                                <div className="flex-grow min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-bold truncate">{cat.label}</p>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                                  </div>
                                  <p className="text-[11px] text-gray-400 mt-0.5 leading-tight line-clamp-1">
                                    {cat.desc}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subject */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700">Subject</label>
                    <div className="relative">
                      <HelpCircle className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        placeholder="Brief summary of your request"
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-gray-700">Message</label>
                    <div className="relative">
                      <MessageSquare className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows={4}
                        placeholder="Describe your issue or request in detail..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all resize-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md shadow-green-600/20 active:scale-[0.99] transition-all text-xs disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {status === "loading" ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Email Message</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export { ContactUs };
