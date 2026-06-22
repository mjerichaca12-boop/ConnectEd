import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const UnreadMessagesContext = createContext(null);

export const useUnreadMessages = () => {
  const context = useContext(UnreadMessagesContext);
  if (!context) {
    throw new Error('useUnreadMessages must be used within an UnreadMessagesProvider');
  }
  return context;
};

export const UnreadMessagesProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadConversations, setUnreadConversations] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  
  // To avoid unneeded re-renders, we keep track in refs
  const currentUserRef = useRef(null);
  const unreadMapRef = useRef({});

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    unreadMapRef.current = unreadConversations;
  }, [unreadConversations]);

  // Authenticate and load initial unread counts
  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        loadInitialUnread(session.user.id);
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        loadInitialUnread(session.user.id);
      } else {
        setCurrentUser(null);
        setUnreadCount(0);
        setUnreadConversations({});
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loadInitialUnread = async (userId) => {
    try {
      // Step 1: Fetch all last_read_at timestamps for this user from conversation_reads
      const { data: readsData, error: readsError } = await supabase
        .from('conversation_reads')
        .select('*')
        .eq('user_id', userId);

      // If table doesn't exist yet, we silently fallback to 0 unread
      if (readsError) {
        console.warn('Could not load conversation reads. Has the table been created?', readsError);
      }

      const readsMap = {};
      (readsData || []).forEach(read => {
        if (read.conversation_id) {
          readsMap[`group_${read.conversation_id}`] = new Date(read.last_read_at).getTime();
        } else if (read.counterpart_id) {
          readsMap[`dm_${read.counterpart_id}`] = new Date(read.last_read_at).getTime();
        }
      });

      // Step 2: Fetch all group conversation IDs this user is part of
      const { data: participantData } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('profile_id', userId);
        
      const groupIds = (participantData || []).map(p => p.conversation_id);

      // Step 3: Fetch messages where user is receiver OR message belongs to one of their groups
      let query = supabase.from('messages').select('id, sender_id, conversation_id, created_at');
      
      if (groupIds.length > 0) {
        query = query.or(`receiver_id.eq.\${userId},conversation_id.in.(\${groupIds.join(',')})`);
      } else {
        query = query.eq('receiver_id', userId);
      }

      const { data: messages, error: msgError } = await query;
      
      if (msgError) {
        console.error('Error fetching messages for unread calculation:', msgError);
        return;
      }

      const newUnreadMap = {};
      let totalUnread = 0;

      (messages || []).forEach(msg => {
        // Skip messages sent by the current user
        if (msg.sender_id === userId) return;

        const msgTime = new Date(msg.created_at).getTime();
        
        let convKey = '';
        if (msg.conversation_id) {
          convKey = `group_\${msg.conversation_id}`;
        } else {
          // Direct message
          convKey = `dm_\${msg.sender_id}`;
        }

        const lastReadTime = readsMap[convKey] || 0;
        if (msgTime > lastReadTime) {
          newUnreadMap[convKey] = (newUnreadMap[convKey] || 0) + 1;
          totalUnread++;
        }
      });

      setUnreadConversations(newUnreadMap);
      setUnreadCount(totalUnread);

    } catch (error) {
      console.error('Error in loadInitialUnread:', error);
    }
  };

  // Real-time subscription to 'messages' table
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel('unread_messages_sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const msg = payload.new;
        if (!msg || msg.sender_id === currentUser.id) return; // Ignore own messages

        // Check if this message is for us
        let isForUs = false;
        let convKey = '';

        if (msg.conversation_id) {
          // Group message: Verify we are a participant
          const { data: pData } = await supabase
            .from('conversation_participants')
            .select('id')
            .eq('profile_id', currentUser.id)
            .eq('conversation_id', msg.conversation_id)
            .maybeSingle();
            
          if (pData) {
            isForUs = true;
            convKey = `group_\${msg.conversation_id}`;
          }
        } else if (msg.receiver_id === currentUser.id) {
          // Direct message
          isForUs = true;
          convKey = `dm_\${msg.sender_id}`;
        }

        if (isForUs) {
          // Add to unread immediately
          setUnreadConversations(prev => {
            const nextMap = { ...prev };
            nextMap[convKey] = (nextMap[convKey] || 0) + 1;
            
            // Calculate total based on new map
            const total = Object.values(nextMap).reduce((acc, val) => acc + val, 0);
            setUnreadCount(total);
            return nextMap;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // Mark conversation as read
  const markAsRead = useCallback(async (conversationId, counterpartId) => {
    if (!currentUserRef.current) return;
    
    const userId = currentUserRef.current.id;
    let convKey = '';
    
    if (conversationId) {
      convKey = `group_\${conversationId}`;
    } else if (counterpartId) {
      convKey = `dm_\${counterpartId}`;
    } else {
      return;
    }

    // Update UI instantly
    setUnreadConversations(prev => {
      if (!prev[convKey]) return prev; // Already read
      
      const nextMap = { ...prev };
      delete nextMap[convKey];
      
      const total = Object.values(nextMap).reduce((acc, val) => acc + val, 0);
      setUnreadCount(total);
      return nextMap;
    });

    // Upsert to database
    try {
      const payload = {
        user_id: userId,
        last_read_at: new Date().toISOString()
      };
      
      if (conversationId) payload.conversation_id = conversationId;
      if (counterpartId) payload.counterpart_id = counterpartId;

      await supabase
        .from('conversation_reads')
        .upsert(payload, {
          onConflict: conversationId ? 'user_id, conversation_id' : 'user_id, counterpart_id'
        });
        
    } catch (err) {
      console.error('Error marking conversation as read:', err);
    }
  }, []);

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, unreadConversations, markAsRead }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
};
