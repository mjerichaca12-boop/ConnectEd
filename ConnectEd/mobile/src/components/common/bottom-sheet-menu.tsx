import React from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Colors from "../../constants/Colors";

interface MenuItem {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: string;
}

interface BottomSheetMenuProps {
    visible: boolean;
    onClose: () => void;
    role: "student" | "teacher" | null;
    onChatbotPress?: () => void;
}

const STUDENT_MENU: MenuItem[] = [
    { label: "School Calendar", icon: "calendar-sharp", route: "/(tabs)/calendar" },
    { label: "Grades", icon: "school-outline", route: "/(tabs)/grades" },
    { label: "Attendance", icon: "checkbox-outline", route: "/(tabs)/attendance" },
    { label: "Chatbot", icon: "chatbubble-ellipses-outline", route: "chatbot" },
    { label: "Profile", icon: "person-outline", route: "/(tabs)/profile" },
];

const TEACHER_MENU: MenuItem[] = [
    { label: "School Calendar", icon: "calendar-sharp", route: "/(tabs)/calendar" },
    { label: "Attendance", icon: "calendar-outline", route: "/(tabs)/teacher/attendance" },
    { label: "Chatbot", icon: "chatbubble-ellipses-outline", route: "chatbot" },
    { label: "Faculty Profile", icon: "person-outline", route: "/(tabs)/profile" },
];

export default function BottomSheetMenu({ visible, onClose, role, onChatbotPress }: BottomSheetMenuProps) {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const menuItems = role === "teacher" ? TEACHER_MENU : STUDENT_MENU;

    const handleMenuPress = (route: string) => {
        onClose();
        if (route === "chatbot") {
            onChatbotPress?.();
        } else {
            router.push(route as any);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
                            <View style={styles.handle} />
                            <Text style={styles.title}>More Options</Text>
                            {menuItems.map((item) => (
                                <TouchableOpacity
                                    key={item.label}
                                    style={styles.menuItem}
                                    onPress={() => handleMenuPress(item.route)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.iconContainer}>
                                        <Ionicons name={item.icon} size={24} color={Colors.light.primary} />
                                    </View>
                                    <Text style={styles.menuLabel}>{item.label}</Text>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.light.textSecondary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "flex-end",
    },
    sheet: {
        backgroundColor: "#FFFFFF",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 12,
        paddingHorizontal: 20,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: "#E2E8F0",
        borderRadius: 2,
        alignSelf: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: Colors.light.text,
        marginBottom: 16,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.light.background,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },
    menuLabel: {
        flex: 1,
        fontSize: 16,
        color: Colors.light.text,
        fontWeight: "500",
    },
});

