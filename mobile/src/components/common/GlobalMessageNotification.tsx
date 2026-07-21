import React, { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Animated,
    TouchableOpacity,
    PanResponder,
    Dimensions
} from "react-native";
import { useRouter, useSegments, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import Colors from "../../constants/Colors";

interface ToastData {
    id: string;
    title: string;
    message: string;
    partnerId: string;
    name: string;
    isRoom: boolean;
}

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function GlobalMessageNotification() {
    const router = useRouter();
    const segments = useSegments();
    const params = useGlobalSearchParams<{ id?: string }>();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [toast, setToast] = useState<ToastData | null>(null);
    
    const slideAnim = useRef(new Animated.Value(-150)).current;
    
    // Store current route details in a ref to avoid re-subscribing on page transitions
    const routeRef = useRef({ segments, id: params.id });

    useEffect(() => {
        routeRef.current = { segments, id: params.id };
    }, [segments, params.id]);

    useEffect(() => {
        // Fetch initial user session
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserId(data?.user?.id || null);
        });

        // Listen for authentication changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setCurrentUserId(session?.user?.id || null);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!currentUserId) return;

        console.log('[global-rt] Subscribing to messages as user:', currentUserId);
        
        const channel = supabase
            .channel('global-chat-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                async (payload) => {
                    const msg = payload.new;
                    console.log('[global-rt] New message detected:', msg.id);

                    // Ignore messages sent by the current user
                    if (msg.sender_id === currentUserId) return;

                    // Ensure this message is relevant to the current user
                    const isRelevant = msg.receiver_id === currentUserId || msg.room_id || msg.conversation_id;
                    if (!isRelevant) return;

                    // Check if the user is already actively chatting inside this conversation
                    const activeChatId = routeRef.current.id;
                    const isOnConversationScreen = routeRef.current.segments.includes('conversation');
                    
                    const isRoom = !!(msg.room_id || (msg.conversation_id && msg.conversation_id.startsWith('group_')));
                    const originId = msg.room_id || msg.conversation_id || msg.sender_id;

                    if (isOnConversationScreen && activeChatId === originId) {
                        console.log('[global-rt] User is currently looking at this conversation. Skipping banner.');
                        return;
                    }

                    // Fetch sender details
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('first_name, last_name, middle_name')
                        .eq('id', msg.sender_id)
                        .maybeSingle();

                    const senderName = profile ? `${profile.first_name || ''} ${profile.middle_name || ''} ${profile.last_name || ''}`.trim().replace(/\s+/g, ' ') : "Someone";
                    let toastTitle = senderName;
                    let chatName = senderName;

                    // Group / Room specific titles
                    if (msg.room_id) {
                        const { data: subject } = await supabase
                            .from('subjects')
                            .select('name')
                            .eq('id', msg.room_id)
                            .maybeSingle();
                        if (subject) {
                            toastTitle = `${senderName} in ${subject.name}`;
                            chatName = subject.name;
                        }
                    } else if (msg.conversation_id) {
                        const { data: conv } = await supabase
                            .from('conversations')
                            .select('name')
                            .eq('id', msg.conversation_id)
                            .maybeSingle();
                        if (conv) {
                            toastTitle = `${senderName} in ${conv.name || "Group Chat"}`;
                            chatName = conv.name || "Group Chat";
                        }
                    }

                    // Display notification banner
                    setToast({
                        id: msg.id,
                        title: toastTitle,
                        message: msg.content || msg.message_text || "Sent an attachment",
                        partnerId: originId,
                        name: chatName,
                        isRoom: isRoom
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);

    useEffect(() => {
        if (toast) {
            // Slide down animation
            Animated.spring(slideAnim, {
                toValue: 50, // Position on screen
                useNativeDriver: true,
                speed: 12,
                bounciness: 6,
            }).start();

            // Auto dismiss after 4.5 seconds
            const timer = setTimeout(() => {
                dismissToast();
            }, 4500);

            return () => clearTimeout(timer);
        }
    }, [toast]);

    const dismissToast = () => {
        Animated.timing(slideAnim, {
            toValue: -150,
            duration: 300,
            useNativeDriver: true,
        }).start(() => {
            setToast(null);
        });
    };

    const handlePress = () => {
        if (toast) {
            router.push({
                pathname: `/conversation/${toast.partnerId}`,
                params: {
                    name: toast.name,
                    isRoom: String(toast.isRoom)
                }
            });
            dismissToast();
        }
    };

    if (!toast) return null;

    return (
        <Animated.View style={[styles.toastContainer, { transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity style={styles.toastTouchable} onPress={handlePress} activeOpacity={0.9}>
                <View style={styles.toastIconContainer}>
                    <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.toastContent}>
                    <Text style={styles.toastTitle} numberOfLines={1}>{toast.title}</Text>
                    <Text style={styles.toastMessage} numberOfLines={1}>{toast.message}</Text>
                </View>
                <TouchableOpacity style={styles.toastClose} onPress={dismissToast}>
                    <Ionicons name="close" size={20} color="#94A3B8" />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        zIndex: 99999, // Ensure it's on top of everything
    },
    toastTouchable: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    toastIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.light.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    toastContent: {
        flex: 1,
    },
    toastTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 2,
    },
    toastMessage: {
        fontSize: 13,
        color: '#64748B',
    },
    toastClose: {
        padding: 6,
        marginLeft: 8,
    }
});
