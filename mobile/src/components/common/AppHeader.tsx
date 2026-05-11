import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "../../constants/Colors";
import { useMyNotificationsQuery } from "../../hooks/query/notifications/use-my-notifications-query";
import { useMarkNotificationsReadMutation } from "../../hooks/query/notifications/use-mark-notifications-read";

interface AppHeaderProps {
    title?: string;
    showProfile?: boolean;
    showBack?: boolean;
    onBack?: () => void;
    hasNotifications?: boolean;
}

// Ensure timestamps render politely
const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString();
};

export default function AppHeader({ title = "ConnectEd", showProfile = true, showBack = false, onBack, hasNotifications = false }: AppHeaderProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

    const { data: notifications = [] } = useMyNotificationsQuery();
    const { mutate: markAllRead } = useMarkNotificationsReadMutation();

    const hasUnread = notifications.some(n => !n.is_read);

    const handleProfilePress = () => {
        router.push("/(tabs)/profile");
    };

    const handleBackPress = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
    };

    const handleNotificationOpen = () => {
        setIsNotificationsOpen(true);
        if (hasUnread) {
            markAllRead();
        }
    };

    const handleNotificationPress = (route?: string) => {
        setIsNotificationsOpen(false);
        if (route) {
            router.push(route as any);
        }
    };

    const renderNotificationItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            style={[styles.notificationItem, !item.is_read && styles.notificationItemUnread]}
            onPress={() => handleNotificationPress(item.type === 'chat' ? '/(tabs)/messages' : undefined)}
        >
            <View style={styles.notificationIconContainer}>
                <Ionicons 
                    name={item.type === 'chat' ? 'chatbubble-ellipses' : 'notifications'} 
                    size={20} 
                    color={!item.is_read ? Colors.light.primary : Colors.light.textSecondary} 
                />
            </View>
            <View style={styles.notificationContent}>
                <Text style={[styles.notificationTitle, !item.is_read && styles.notificationTitleUnread]} numberOfLines={2}>
                    {item.title}
                </Text>
                <Text style={styles.notificationTime}>{formatTime(item.created_at)}</Text>
            </View>
            {!item.is_read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );

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
                        >
                            <Ionicons name="notifications" size={22} color="#FFFFFF" />
                            {hasUnread && <View style={styles.notificationBadge} />}
                        </TouchableOpacity>
                    )}
                    {showProfile && (
                        <TouchableOpacity
                            style={styles.avatarButton}
                            onPress={handleProfilePress}
                            activeOpacity={0.7}
                        >
                            <View style={styles.avatar}>
                                <Ionicons name="person" size={16} color="#FFFFFF" />
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
                            <Text style={styles.modalTitle}>Notifications</Text>
                            <TouchableOpacity onPress={() => setIsNotificationsOpen(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        
                        
                        {notifications.length === 0 ? (
                            <View style={{ padding: 30, alignItems: 'center' }}>
                                <Text style={{ color: Colors.light.textSecondary }}>No notifications yet.</Text>
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
        backgroundColor: Colors.light.primary,
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
    },
    notificationBadge: {
        position: "absolute",
        top: 2,
        right: 4,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#EF4444", 
        borderWidth: 2,
        borderColor: Colors.light.primary,
    },
    
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center"
    },
    modalContainer: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: Colors.light.text,
    },
    closeButton: {
        padding: 4,
    },
    notificationList: {
        paddingBottom: 16,
    },
    notificationItem: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F8FAFC",
        alignItems: 'center',
    },
    notificationItemUnread: {
        backgroundColor: "#F0FDF4", // Very light green/primary tint
    },
    notificationIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#F1F5F9",
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 15,
        color: Colors.light.text,
        marginBottom: 4,
    },
    notificationTitleUnread: {
        fontWeight: 'bold',
    },
    notificationTime: {
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.light.primary,
        marginLeft: 8,
    }
});
