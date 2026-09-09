import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable, Image, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "../../constants/Colors";
import { supabase } from "../../lib/supabase";
import { useMyNotificationsQuery } from "../../hooks/query/notifications/use-my-notifications-query";
import { useMarkNotificationsReadMutation, useMarkNotificationItemReadMutation } from "../../hooks/query/notifications/use-mark-notifications-read";

interface AppHeaderProps {
    title?: string;
    showProfile?: boolean;
    showBack?: boolean;
    onBack?: () => void;
    hasNotifications?: boolean;
}

// Ensure timestamps render politely
const formatTime = (dateString: string) => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const now = new Date();
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
};

import { getNotificationMeta, getNotificationRoute } from "../../utils/notification-navigation";

export default function AppHeader({ title = "ConnectEd", showProfile = true, showBack = false, onBack, hasNotifications = false }: AppHeaderProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<'student' | 'teacher' | 'admin'>('student');

    useEffect(() => {
        let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

        supabase.auth.getUser().then(({ data }) => {
            const user = data?.user;
            if (!user) return;

            const meta = user.user_metadata || {};
            if (meta.avatar_url) setAvatarUrl(meta.avatar_url);
            if (meta.role) setUserRole(meta.role);

            // Fetch current avatar & role from profile row
            supabase
                .from('profiles')
                .select('avatar_url, role')
                .eq('id', user.id)
                .maybeSingle()
                .then(({ data: profile }) => {
                    if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
                    if (profile?.role) setUserRole(profile.role);
                });

            // Subscribe to realtime profile changes (e.g. updated from web)
            realtimeChannel = supabase
                .channel(`appheader-profile-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'profiles',
                        filter: `id=eq.${user.id}`,
                    },
                    (payload) => {
                        const newAvatarUrl = (payload?.new as any)?.avatar_url;
                        const newRole = (payload?.new as any)?.role;
                        if (newAvatarUrl !== undefined) {
                            setAvatarUrl(newAvatarUrl || null);
                        }
                        if (newRole) {
                            setUserRole(newRole);
                        }
                    }
                )
                .subscribe();
        });

        return () => {
            if (realtimeChannel) {
                supabase.removeChannel(realtimeChannel);
            }
        };
    }, []);

    const { data: notifications = [] } = useMyNotificationsQuery();
    const { mutate: markAllRead } = useMarkNotificationsReadMutation();
    const { mutate: markItemRead } = useMarkNotificationItemReadMutation();

    const unreadCount = notifications.filter(n => !n.is_read).length;
    const hasUnread = unreadCount > 0;

    const handleProfilePress = () => {
        router.push("/(tabs)/profile");
    };

    const handleBackPress = () => {
        if (onBack) {
            onBack();
        } else {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.push(userRole === 'teacher' ? "/(tabs)/teacher-home" : "/(tabs)/home" as any);
            }
        }
    };

    const handleNotificationOpen = () => {
        setIsNotificationsOpen(true);
        // Do NOT mark all read upon opening modal!
        // Items remain unread so the badge number does not disappear unless explicitly read.
    };

    const handleNotificationItemPress = (item: any) => {
        if (!item.is_read) {
            markItemRead(item.id);
        }
        setIsNotificationsOpen(false);

        const routeResult = getNotificationRoute(item, userRole);
        if (routeResult.params) {
            router.push({
                pathname: routeResult.pathname as any,
                params: routeResult.params,
            });
        } else {
            router.push(routeResult.pathname as any);
        }
    };

    const handleMarkAllRead = () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        markAllRead(unreadIds);
    };

    const renderNotificationItem = ({ item }: { item: any }) => {
        const meta = getNotificationMeta(item);

        return (
            <TouchableOpacity 
                style={[styles.notificationItem, !item.is_read && styles.notificationItemUnread]}
                onPress={() => handleNotificationItemPress(item)}
                activeOpacity={0.7}
            >
                <View style={[styles.notificationIconContainer, { backgroundColor: meta.bg }]}>
                    <Ionicons 
                        name={meta.icon as any} 
                        size={20} 
                        color={meta.color} 
                    />
                </View>
                <View style={styles.notificationContent}>
                    <Text style={[styles.notificationTitle, !item.is_read && styles.notificationTitleUnread]} numberOfLines={2}>
                        {item.title}
                    </Text>
                    {item.body ? (
                        <Text style={styles.notificationBody} numberOfLines={2}>
                            {item.body}
                        </Text>
                    ) : null}
                    <Text style={styles.notificationTime}>{formatTime(item.created_at)}</Text>
                </View>
                {!item.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.content}>
                <View style={styles.leftContainer}>
                    {showBack && (
                        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                    <Text style={styles.title}>{title}</Text>
                </View>
                <View style={styles.rightContainer}>
                    {hasNotifications && (
                        <TouchableOpacity 
                            style={styles.notificationButton} 
                            activeOpacity={0.7}
                            onPress={handleNotificationOpen}
                            accessibilityLabel="Notifications"
                        >
                            <Ionicons name="notifications" size={22} color="#FFFFFF" />
                            {hasUnread && (
                                <View style={styles.notificationBadge}>
                                    <Text style={styles.notificationBadgeText} numberOfLines={1}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                    {showProfile && (
                        <TouchableOpacity
                            style={styles.avatarButton}
                            onPress={handleProfilePress}
                            activeOpacity={0.7}
                            accessibilityLabel="Profile"
                        >
                            <View style={styles.avatar}>
                                {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} style={styles.headerAvatarImage} />
                                ) : (
                                    <Ionicons name="person" size={16} color="#FFFFFF" />
                                )}
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Notifications Modal Overlay */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isNotificationsOpen}
                onRequestClose={() => setIsNotificationsOpen(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setIsNotificationsOpen(false)}>
                    <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalTitleRow}>
                                <Text style={styles.modalTitle}>Notifications</Text>
                                {unreadCount > 0 && (
                                    <View style={styles.modalCountBadge}>
                                        <Text style={styles.modalCountBadgeText}>{unreadCount}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.modalActionRow}>
                                {unreadCount > 0 && (
                                    <TouchableOpacity 
                                        onPress={handleMarkAllRead} 
                                        style={styles.markAllButton}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={styles.markAllText}>Mark all as read</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => setIsNotificationsOpen(false)} style={styles.closeButton}>
                                    <Ionicons name="close" size={22} color={Colors.light.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        
                        {notifications.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="notifications-off-outline" size={48} color="#CBD5E1" />
                                <Text style={styles.emptyText}>No notifications yet.</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={notifications}
                                keyExtractor={(item) => item.id}
                                renderItem={renderNotificationItem}
                                contentContainerStyle={styles.notificationList}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.light.forestGreen,
        paddingBottom: 8,
    },
    content: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    leftContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#FFFFFF",
    },
    rightContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    notificationButton: {
        marginRight: 16,
        padding: 4,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarButton: {
        padding: 2,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(255, 255, 255, 0.3)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#FFFFFF",
        overflow: 'hidden',
    },
    headerAvatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
    },
    notificationBadge: {
        position: "absolute",
        top: -3,
        right: -6,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: "#EF4444", 
        borderWidth: 1.5,
        borderColor: Colors.light.forestGreen,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 3.5,
        zIndex: 10,
    },
    notificationBadgeText: {
        color: "#FFFFFF",
        fontSize: 10,
        fontWeight: "700",
        textAlign: "center",
        textAlignVertical: "center",
        includeFontPadding: false,
        lineHeight: Platform.OS === 'ios' ? 12 : 13,
    },
    
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 420,
        maxHeight: '80%',
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    modalTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: "700",
        color: Colors.light.text,
    },
    modalCountBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    modalCountBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
    },
    modalActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    markAllButton: {
        paddingVertical: 4,
        paddingHorizontal: 6,
    },
    markAllText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.light.primary,
    },
    closeButton: {
        padding: 4,
    },
    notificationList: {
        paddingBottom: 16,
    },
    notificationItem: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F8FAFC",
        alignItems: 'center',
    },
    notificationItemUnread: {
        backgroundColor: "#F0FDF4", // Very light primary tint for unread items
    },
    notificationIconContainer: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.light.text,
        lineHeight: 18,
    },
    notificationTitleUnread: {
        fontWeight: '700',
        color: '#0F172A',
    },
    notificationBody: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
        lineHeight: 16,
    },
    notificationTime: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 4,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        marginLeft: 8,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    emptyText: {
        fontSize: 14,
        color: Colors.light.textSecondary,
    }
});
