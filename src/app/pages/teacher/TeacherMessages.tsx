import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherSidebar } from '@/app/components/TeacherSidebar';
import { Bell, MessageSquare, Search, Send } from 'lucide-react';

interface Conversation {
  id: string;
  participantName: string;
  participantRole: 'Student' | 'Admin';
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export function TeacherMessages() {
  const navigate = useNavigate();
  const [teacherName, setTeacherName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [notifications, setNotifications] = useState(5);
  const [loading, setLoading] = useState(true);

  const [conversations] = useState<Conversation[]>([
    {
      id: '1',
      participantName: 'Juan Dela Cruz',
      participantRole: 'Student',
      lastMessage: 'Thank you for the feedback on my project!',
      lastMessageTime: '2026-01-16T10:30:00',
      unreadCount: 1
    },
    {
      id: '2',
      participantName: 'Admin Office',
      participantRole: 'Admin',
      lastMessage: 'Grade submission deadline is Friday',
      lastMessageTime: '2026-01-15T14:20:00',
      unreadCount: 0
    }
  ]);

  useEffect(() => {
    const userData = localStorage.getItem('currentUser');
    const schoolData = localStorage.getItem('selectedSchool');

    if (!userData) {
      navigate('/school-selection');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'teacher') {
      navigate('/school-selection');
      return;
    }

    setTeacherName(user.name);
    if (schoolData) {
      const school = JSON.parse(schoolData);
      setSchoolName(school.name);
    }

    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/school-selection');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <TeacherSidebar teacherName={teacherName} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
                <p className="text-sm text-gray-600">{schoolName}</p>
              </div>
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-600" />
                {notifications > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white shadow-lg">
            <h1 className="text-3xl font-bold mb-2">Messages</h1>
            <p className="text-emerald-50">Communicate with students and administrators</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="space-y-4">
              {conversations.map((conv) => (
                <div key={conv.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{conv.participantName}</p>
                      <p className="text-sm text-gray-600 mt-1">{conv.lastMessage}</p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="w-6 h-6 bg-emerald-600 text-white text-xs rounded-full flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
