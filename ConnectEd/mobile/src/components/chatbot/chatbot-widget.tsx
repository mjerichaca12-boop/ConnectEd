import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    TextInput, 
    FlatList, 
    KeyboardAvoidingView, 
    Platform, 
    ActivityIndicator,
    Modal,
    SafeAreaView,
    ScrollView,
    Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Colors from '../../constants/Colors';
import Layout from '../../constants/Layout';
import { sendChatMessage } from '../../data/chat/send-chat-message';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    attachment?: string;
}

export interface ChatbotWidgetRef {
    open: () => void;
}

interface ChatbotWidgetProps {
    role?: 'student' | 'teacher' | null;
}

const QUICK_ACTIONS = [
    { label: 'Lesson Plan', icon: 'journal-outline', prompt: 'Help me create a lesson plan for ' },
    { label: 'Summarize', icon: 'document-text-outline', prompt: 'Please summarize this: ' },
    { label: 'Translate', icon: 'language-outline', prompt: 'Translate this to Filipino: ' },
    { label: 'Quiz Gen', icon: 'help-circle-outline', prompt: 'Generate 5 quiz questions about ' },
    { label: 'Study Hint', icon: 'bulb-outline', prompt: 'Give me a hint for my lesson in ' },
];

const GRADE_LEVELS = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
const SUBJECTS = ['English', 'Mathematics', 'Science', 'Aralin Panlipunan', 'Filipino', 'MAPEH', 'TLE', 'ICT'];

const ChatbotWidget = forwardRef<ChatbotWidgetRef, ChatbotWidgetProps>((props, ref) => {
    const insets = useSafeAreaInsets();
    const { role = 'student' } = props;
    const [isVisible, setIsVisible] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedGrade, setSelectedGrade] = useState('Grade 7');
    const [selectedSubject, setSelectedSubject] = useState('English');
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        const greeting = "👋 Hello! I'm your AI Assistant. I can help you with lesson plans, summaries, translations, and more. \n\nPlease select your Grade and Subject in settings above to get started! 🎓";
        
        setMessages([
            {
                id: '1',
                role: 'assistant',
                content: greeting,
                timestamp: new Date()
            }
        ]);
    }, []);

    useImperativeHandle(ref, () => ({
        open: () => setIsVisible(true)
    }));

    const handleFileUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                setInput(prev => prev + ` [Attached File: ${file.name}] `);
                Alert.alert("File Attached", `Ready to send: ${file.name}`);
            }
        } catch (error) {
            console.error("Document picking failed", error);
        }
    };

    const handleSend = async (customText?: string) => {
        const textToSend = customText || input.trim();
        if (!textToSend || isLoading) return;

        const contextInfo = `[Context: ${selectedGrade}, ${selectedSubject}] `;
        const fullText = contextInfo + textToSend;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: textToSend,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        if (!customText) setInput('');
        setIsLoading(true);

        try {
            const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
            chatHistory.push({ role: 'user', content: fullText });

            const reply = await sendChatMessage(chatHistory, role || 'student');
            
            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: reply,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Error: Failed to connect. Please make sure your GROQ_API_KEY is set in the backend .env file.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isVisible) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [isVisible, messages]);

    const renderMessage = ({ item }: { item: Message }) => {
        const isUser = item.role === 'user';
        return (
            <View style={[
                styles.messageBubble, 
                isUser ? styles.userBubble : styles.assistantBubble
            ]}>
                <Text style={[
                    styles.messageText,
                    isUser ? styles.userText : styles.assistantText
                ]}>
                    {item.content}
                </Text>
            </View>
        );
    };

    return (
        <>
            <TouchableOpacity 
                style={styles.floatingButton} 
                onPress={() => setIsVisible(true)}
            >
                <Ionicons name="chatbubble-ellipses" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <Modal
                visible={isVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setIsVisible(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <TouchableOpacity onPress={() => setShowSettings(!showSettings)} style={styles.settingsToggle}>
                                <Ionicons name="settings-outline" size={20} color={Colors.light.primary} />
                            </TouchableOpacity>
                            <View>
                                <Text style={styles.headerTitle}>ConnectEd AI Assistant</Text>
                                <Text style={styles.headerSub}>{selectedGrade} • {selectedSubject}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setIsVisible(false)}>
                            <Ionicons name="close" size={24} color={Colors.light.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Generation Settings Section */}
                    {showSettings && (
                        <View style={styles.settingsPanel}>
                            <Text style={styles.settingsTitle}>Generation Settings</Text>
                            
                            <Text style={styles.label}>Year Level</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                {GRADE_LEVELS.map(g => (
                                    <TouchableOpacity 
                                        key={g} 
                                        style={[styles.chip, selectedGrade === g && styles.activeChip]}
                                        onPress={() => setSelectedGrade(g)}
                                    >
                                        <Text style={[styles.chipText, selectedGrade === g && styles.activeChipText]}>{g}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={styles.label}>Subject</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                {SUBJECTS.map(s => (
                                    <TouchableOpacity 
                                        key={s} 
                                        style={[styles.chip, selectedSubject === s && styles.activeChip]}
                                        onPress={() => setSelectedSubject(s)}
                                    >
                                        <Text style={[styles.chipText, selectedSubject === s && styles.activeChipText]}>{s}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            
                            <TouchableOpacity style={styles.closeSettingsBtn} onPress={() => setShowSettings(false)}>
                                <Text style={styles.closeSettingsText}>Save & Close</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.chatContent}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        ListFooterComponent={() => (
                            <View style={styles.quickActionsContainer}>
                                <Text style={styles.quickActionsTitle}>Quick Actions</Text>
                                <View style={styles.quickActionsGrid}>
                                    {QUICK_ACTIONS.map((action, idx) => (
                                        <TouchableOpacity 
                                            key={idx} 
                                            style={styles.actionButton}
                                            onPress={() => handleSend(action.prompt + selectedSubject)}
                                        >
                                            <Ionicons name={action.icon as any} size={16} color={Colors.light.primary} />
                                            <Text style={styles.actionLabel}>{action.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}
                    />

                    {isLoading && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={Colors.light.primary} />
                            <Text style={styles.loadingText}>Thinking...</Text>
                        </View>
                    )}

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                    >
                        <View style={[
                            styles.inputContainer, 
                            { paddingBottom: Math.max(insets.bottom, 12) }
                        ]}>
                            <TouchableOpacity style={styles.attachBtn} onPress={handleFileUpload}>
                                <Ionicons name="add" size={24} color={Colors.light.primary} />
                            </TouchableOpacity>
                            <TextInput
                                style={styles.input}
                                placeholder="Type your message here..."
                                value={input}
                                onChangeText={setInput}
                                multiline
                                maxHeight={100}
                            />
                            <TouchableOpacity 
                                style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
                                onPress={() => handleSend()}
                                disabled={!input.trim() || isLoading}
                            >
                                <Ionicons 
                                    name="send" 
                                    size={20} 
                                    color={input.trim() ? "#FFFFFF" : "rgba(255,255,255,0.5)"} 
                                />
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
        </>
    );
});

const styles = StyleSheet.create({
    floatingButton: {
        position: 'absolute',
        bottom: 80,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.light.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
        zIndex: 9999,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Layout.spacing.m,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
        backgroundColor: '#FFFFFF',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    settingsToggle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0FAF5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.light.text,
    },
    headerSub: {
        fontSize: 12,
        color: Colors.light.textSecondary,
    },
    settingsPanel: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    settingsTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.light.text,
        marginBottom: 12,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.light.textSecondary,
        marginBottom: 8,
        marginTop: 8,
    },
    chipScroll: {
        marginBottom: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    activeChip: {
        backgroundColor: '#F0FAF5',
        borderColor: Colors.light.primary,
    },
    chipText: {
        fontSize: 13,
        color: Colors.light.textSecondary,
    },
    activeChipText: {
        color: Colors.light.primary,
        fontWeight: 'bold',
    },
    closeSettingsBtn: {
        marginTop: 12,
        backgroundColor: Colors.light.primary,
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    closeSettingsText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    chatContent: {
        padding: Layout.spacing.m,
        paddingBottom: 40,
    },
    messageBubble: {
        maxWidth: '85%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: Colors.light.primary,
        borderBottomRightRadius: 4,
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    userText: {
        color: '#FFFFFF',
    },
    assistantText: {
        color: Colors.light.text,
    },
    quickActionsContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
    },
    quickActionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.light.textSecondary,
        marginBottom: 12,
    },
    quickActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.light.border,
        gap: 6,
    },
    actionLabel: {
        fontSize: 13,
        color: Colors.light.text,
        fontWeight: '500',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Layout.spacing.m,
        paddingBottom: 16,
        gap: 8,
    },
    loadingText: {
        fontSize: 12,
        color: Colors.light.textSecondary,
        fontStyle: 'italic',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
        gap: 8,
    },
    attachBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: Colors.light.text,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.light.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#CBD5E1',
    },
});

export default ChatbotWidget;
