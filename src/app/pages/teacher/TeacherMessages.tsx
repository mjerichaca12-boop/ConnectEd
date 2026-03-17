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
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([
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
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('currentUser');

    if (!userData) {
      navigate('/login');
      return;
    }

    const user = JSON.parse(userData);
    if (user.role !== 'teacher') {
      navigate('/login');
      return;
    }

    setTeacherName(user.name);
    setTimeout(() => setLoading(false), 600);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/login');
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
              </div>
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6 text-gray-600" />
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Conversations list */}
              <div className="lg:col-span-1 space-y-4">
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div className="space-y-2">
                  {conversations
                    .filter((conv) =>
                      conv.participantName.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() => {
                          setSelectedConversation(conv);
                          if (conv.unreadCount > 0) {
                            setConversations((prev) =>
                              prev.map((c) =>
                                c.id === conv.id ? { ...c, unreadCount: 0 } : c
                              )
                            );
                          }
                        }}
                        className={`p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors ${
                          selectedConversation?.id === conv.id ? 'border-emerald-500' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{conv.participantName}</p>
                            <p className="text-xs text-gray-500">
                              {conv.participantRole} •{' '}
                              {new Date(conv.lastMessageTime).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {conv.lastMessage}
                            </p>
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

              {/* Conversation detail */}
              <div className="lg:col-span-2">
                {selectedConversation ? (
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
                      <div>
                        <p className="text-lg font-semibold text-gray-900">
                          {selectedConversation.participantName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {selectedConversation.participantRole}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 mb-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700">
                          {selectedConversation.lastMessage}
                        </p>
                      </div>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!messageInput.trim() || !selectedConversation) return;
                        const newText = messageInput.trim();
                        setConversations((prev) =>
                          prev.map((c) =>
                            c.id === selectedConversation.id
                              ? { ...c, lastMessage: newText, lastMessageTime: new Date().toISOString() }
                              : c
                          )
                        );
                        setSelectedConversation((prev) =>
                          prev
                            ? { ...prev, lastMessage: newText, lastMessageTime: new Date().toISOString() }
                            : prev
                        );
                        setMessageInput('');
                      }}
                      className="flex items-center gap-2 border-t border-gray-200 pt-4"
                    >
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                      <button
                        type="submit"
                        className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center border border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
                    Select a conversation to start messaging.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
