import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Image, TextInput, Modal, StatusBar } from "react-native";
import { useLocalSearchParams, useSegments, useRouter, useGlobalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";

import Colors from "../../../../src/constants/Colors";
import Layout from "../../../../src/constants/Layout";
import StatusBadge from "../../../../src/components/common/StatusBadge";
import Button from "../../../../src/components/common/Button";
import AppHeader from "../../../../src/components/common/AppHeader";
import FileUploadComponent from "../../../../src/components/common/FileUploadComponent";
import FileViewerModal from "../../../../src/components/common/FileViewerModal";

import { supabase } from "../../../../src/lib/supabase";
import { useMyAssignmentsQuery } from "../../../../src/hooks/query/assignments/use-my-assignments-query";

import { parseQuiz, ParsedQuiz, QuizQuestion } from "../../../../src/utils/quiz-parser";

const AssignmentItem = ({ title, dueDate, status, grade, assessmentType, onPress }: any) => {
    const isLate = status === "late";
    const hasGrade = typeof grade !== "undefined" && grade !== null;
    const isQuiz = assessmentType === "quiz";
    return (
        <TouchableOpacity 
            style={[styles.itemContainer, isLate && styles.lateItemContainer]} 
            onPress={onPress}
        >
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <View style={{ 
                        backgroundColor: isQuiz ? '#EFF6FF' : '#F0FDF4', 
                        paddingHorizontal: 6, 
                        paddingVertical: 1, 
                        borderRadius: 4,
                        borderWidth: 0.5,
                        borderColor: isQuiz ? '#BFDBFE' : '#BBF7D0'
                    }}>
                        <Text style={{ 
                            fontSize: 9, 
                            fontWeight: 'bold', 
                            color: isQuiz ? '#1E40AF' : '#166534',
                            textTransform: 'uppercase'
                        }}>
                            {assessmentType || 'task'}
                        </Text>
                    </View>
                </View>
                <Text style={[styles.title, isLate && styles.lateText]}>{title}</Text>
                <Text style={[styles.date, isLate && styles.lateText]}>Due: {dueDate}</Text>
            </View>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                {hasGrade && (
                    <View style={{ backgroundColor: "#F0FDF4", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: "#BBF7D0" }}>
                        <Text style={{ color: "#166534", fontWeight: "bold", fontSize: 12 }}>Grade: {grade}</Text>
                    </View>
                )}
                <StatusBadge status={status} />
            </View>
        </TouchableOpacity>
    );
};

const DetailedAssignmentView = ({ assignment, onBack }: any) => {
    const [pickedFile, setPickedFile] = useState<any>(null);
    const [responseText, setResponseText] = useState("");
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
    const [isQuizStarted, setIsQuizStarted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [viewerVisible, setViewerVisible] = useState(false);
    const [viewerUrl, setViewerUrl] = useState<string | null>(null);
    const [viewerTitle, setViewerTitle] = useState<string | null>(null);
    const [hasAttemptedQuiz, setHasAttemptedQuiz] = useState(false);
    const [quizAttemptData, setQuizAttemptData] = useState<any>(null);
    const queryClient = useQueryClient();

    const [dbQuestions, setDbQuestions] = useState<any[]>([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

    React.useEffect(() => {
        const checkQuizAttempt = async () => {
            try {
                const { data: userData } = await supabase.auth.getUser();
                const uid = userData?.user?.id;
                if (uid && assignment && assignment.assessment_type === 'quiz') {
                    const { data, error } = await supabase
                        .from('quiz_attempts')
                        .select('*')
                        .eq('quiz_id', assignment.id)
                        .eq('student_id', uid)
                        .maybeSingle();
                    if (!error && data) {
                        setHasAttemptedQuiz(true);
                        setQuizAttemptData(data);
                    }
                }
            } catch (err) {
                console.error("Error checking quiz attempt:", err);
            }
        };
        checkQuizAttempt();
    }, [assignment?.id]);

    React.useEffect(() => {
        if (assignment && assignment.assessment_type === 'quiz') {
            setIsLoadingQuestions(true);
            supabase
                .from('quiz_questions')
                .select('*')
                .eq('quiz_id', assignment.id)
                .order('order_index', { ascending: true })
                .then(({ data, error }) => {
                    setIsLoadingQuestions(false);
                    if (!error && data) {
                        setDbQuestions(data);
                    } else if (error) {
                        console.error("Failed to fetch quiz questions:", error.message);
                    }
                });
        }
    }, [assignment?.id]);

    const quizData = React.useMemo(() => {
        if (assignment.assessment_type !== 'quiz') return null;
        if (dbQuestions && dbQuestions.length > 0) {
            return {
                instructionsHeader: assignment.description || assignment.instructions || "Please answer the questions below.",
                questions: dbQuestions.map((q, idx) => {
                    const questionNumber = idx + 1;
                    
                    let formattedOptions: { label: string; text: string }[] = [];
                    if (Array.isArray(q.options)) {
                        formattedOptions = q.options.map((optText: any, optIdx: number) => {
                            const label = String.fromCharCode(65 + optIdx); // A, B, C, D...
                            return {
                                label: label,
                                text: String(optText)
                            };
                        });
                    } else if (q.question_type === 'True/False') {
                        formattedOptions = [
                            { label: 'True', text: 'True' },
                            { label: 'False', text: 'False' }
                        ];
                    }

                    let resolvedCorrectAnswer = q.correct_answer || '';
                    if (q.question_type === 'Multiple Choice' && Array.isArray(q.options)) {
                        const optIdx = q.options.findIndex((opt: any) => String(opt).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase());
                        if (optIdx !== -1) {
                            resolvedCorrectAnswer = String.fromCharCode(65 + optIdx); // A, B, C, D...
                        }
                    }

                    return {
                        id: q.id,
                        questionNumber: questionNumber,
                        questionText: q.question_text || '',
                        questionType: q.question_type || 'Multiple Choice',
                        options: formattedOptions,
                        correctAnswer: resolvedCorrectAnswer,
                        points: q.points || 1,
                    };
                })
            };
        }
        // Fallback to instructions parser
        const text = typeof assignment.instructions === 'string' ? assignment.instructions : String(assignment.instructions || '');
        return parseQuiz(text);
    }, [assignment, dbQuestions]);

    const openFileViewer = (url: string, title: string) => {
        setViewerUrl(url);
        setViewerTitle(title);
        setViewerVisible(true);
    };

    const handleFileUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                
                // Limit size to 150MB
                const maxSize = 150 * 1024 * 1024;
                if (file.size && file.size > maxSize) {
                    Alert.alert("Limit Exceeded", "File size must be less than 150MB.");
                    return;
                }

                setPickedFile(file);
            }
        } catch (err) {
            console.error("Picker error:", err);
        }
    };

    const handleImageUpload = async (useCamera: boolean = false) => {
        try {
            const permissionResult = useCamera 
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permissionResult.status !== 'granted') {
                Alert.alert(
                    "Permission Required", 
                    `Please grant ${useCamera ? 'camera' : 'photo library'} permissions to upload an image.`
                );
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({
                    allowsEditing: true,
                    quality: 0.8,
                  })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    allowsEditing: true,
                    quality: 0.8,
                  });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const uri = asset.uri;
                const ext = uri.split('.').pop() || 'jpg';
                const name = `image_${Date.now()}.${ext}`;
                setPickedFile({
                    uri: uri,
                    name: name,
                    mimeType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
                    size: asset.fileSize || 1024 * 1024,
                });
            }
        } catch (err) {
            console.error("Image picker error:", err);
            Alert.alert("Error", "Failed to select image.");
        }
    };

    const handleSubmit = async () => {
        const isQuiz = assignment.assessment_type === 'quiz';
        
        if (isQuiz) {
            if (quizData) {
                const unanswered = quizData.questions.filter(q => {
                    const ans = selectedAnswers[q.questionNumber];
                    return !ans || (typeof ans === 'string' && !ans.trim());
                });
                if (unanswered.length > 0 && !pickedFile) {
                    Alert.alert(
                        "Validation Error", 
                        `Please answer all questions before submitting. Unanswered: ${unanswered.map(q => q.questionNumber).join(", ")}`
                    );
                    return;
                }
            } else {
                if (!responseText.trim() && !pickedFile) {
                    Alert.alert("Validation Error", "Please write your answers or upload a file/picture before submitting.");
                    return;
                }
            }
        } else if (!responseText.trim() && !pickedFile) {
            Alert.alert("Validation Error", "Please enter a response or attach a file before submitting.");
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;

            if (!userId) throw new Error("User not found");

            let publicUrl = null;
            let storagePath = null;

            // 1. Upload file to storage if picked
            if (pickedFile) {
                storagePath = `submissions/${userId}/${Date.now()}_${pickedFile.name}`;

                // Read file as base64 for reliable binary upload
                const base64 = await FileSystem.readAsStringAsync(pickedFile.uri, { encoding: 'base64' });
                const bytes = decode(base64);

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('class-materials')
                    .upload(storagePath, bytes, {
                        contentType: pickedFile.mimeType || 'application/octet-stream',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl: url } } = supabase.storage
                    .from('class-materials')
                    .getPublicUrl(storagePath);
                
                publicUrl = url;
            }



            // Fetch teacher_id from subjects table using course_id / subjectId
            let teacherId = null;
            const subjectId = assignment.course_id || assignment.subject_id;
            if (subjectId) {
                const { data: subjectData } = await supabase
                    .from('subjects')
                    .select('teacher_id')
                    .eq('id', subjectId)
                    .maybeSingle();
                
                if (subjectData && subjectData.teacher_id) {
                    teacherId = subjectData.teacher_id;
                }
            }

            // Calculate quiz score if quizData is present
            let score = 0;
            let correctCount = 0;
            let jsonText = "";

            if (isQuiz && quizData) {
                quizData.questions.forEach(q => {
                    let isCorrect = false;
                    const studentAns = selectedAnswers[q.questionNumber];
                    if (q.questionType === 'Multiple Choice' || q.questionType === 'True/False') {
                        isCorrect = studentAns === q.correctAnswer;
                    } else if (q.questionType === 'Identification' || q.questionType === 'Short Answer') {
                        isCorrect = String(studentAns || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase();
                    }
                    if (isCorrect) {
                        correctCount++;
                    }
                });
                score = (correctCount / quizData.questions.length) * 100;
                jsonText = `DATA_JSON:${JSON.stringify({
                    answers: selectedAnswers,
                    score: Math.round(score),
                    correctCount,
                    totalQuestions: quizData.questions.length,
                    questions: quizData.questions
                })}`;
            }
            // If we found teacherId, upsert into teacher_assessment_submissions as well
            if (teacherId && subjectId) {
                const payload: any = {
                    teacher_id: teacherId,
                    subject_id: subjectId,
                    assessment_id: assignment.id,
                    student_id: userId,
                    response_text: isQuiz && quizData ? jsonText : (responseText.trim() || "Submitted via Mobile App"),
                    file_url: publicUrl,
                    file_name: pickedFile ? pickedFile.name : null,
                    file_path: storagePath,
                    status: 'submitted'
                };
                let { error: teacherSubError } = await supabase
                    .from('teacher_assessment_submissions')
                    .upsert(payload, { onConflict: 'teacher_id,subject_id,assessment_id,student_id' });

                if (teacherSubError && teacherSubError.code === 'PGRST204') {
                    const { status, ...fallbackPayload } = payload;
                    const { error: fallbackError } = await supabase
                        .from('teacher_assessment_submissions')
                        .upsert(fallbackPayload, { onConflict: 'teacher_id,subject_id,assessment_id,student_id' });
                    teacherSubError = fallbackError;
                }

                if (teacherSubError) {
                    throw teacherSubError;
                }
            }

            // Directly upsert into teacher_assessment_grades if auto-graded
            if (isQuiz && quizData && teacherId && subjectId) {
                const { error: gradeError } = await supabase
                    .from('teacher_assessment_grades')
                    .upsert({
                        teacher_id: teacherId,
                        subject_id: subjectId,
                        assessment_id: assignment.id,
                        assessment_title: assignment.title || '',
                        assessment_type: assignment.assessment_type || 'quiz',
                        student_id: userId,
                        grade_value: Math.round(score),
                        max_points: 100,
                        status: 'Graded',
                        feedback: `Auto-graded quiz: ${correctCount}/${quizData.questions.length} correct.`
                    }, { onConflict: 'teacher_id,subject_id,assessment_id,student_id' });
                
                if (gradeError) {
                    console.error("Failed to upsert grade:", gradeError);
                }
            }

            // Also record in quiz_attempts table
            if (quizData && userId) {
                try {
                    const attemptPayload = {
                        quiz_id: assignment.id,
                        student_id: userId,
                        score: Math.round(score),
                        answers: selectedAnswers,
                        status: 'Submitted'
                    };

                    const { error: upsertError } = await supabase
                        .from('quiz_attempts')
                        .upsert(attemptPayload, { onConflict: 'quiz_id,student_id' });

                    if (upsertError) {
                        await supabase
                            .from('quiz_attempts')
                            .insert(attemptPayload);
                    }
                } catch (quizAttemptErr) {
                    console.log("quiz_attempts optional sync:", quizAttemptErr);
                }
            }

            if (isQuiz && quizData) {
                setHasAttemptedQuiz(true);
                setQuizAttemptData({
                    score: Math.round(score),
                    correct_count: correctCount,
                    total_questions: quizData.questions.length,
                    answers: selectedAnswers,
                    response_text: jsonText,
                    status: 'completed'
                });
            }

            // Invalidate and refetch immediately to ensure local cache updates
            queryClient.invalidateQueries({ queryKey: ['my-assignments'] });
            queryClient.invalidateQueries({ queryKey: ['my-assignments', assignment.subjectId] });
            queryClient.refetchQueries({ queryKey: ['my-assignments'] });

            Alert.alert(
                "Submission Complete", 
                "Your work has been successfully submitted.",
                [{ text: "OK", onPress: async () => {
                    await queryClient.invalidateQueries({ queryKey: ['my-assignments'] });
                    onBack("submitted");
                }}]
            );
        } catch (err: any) {
            console.error("Submit error:", err);
            Alert.alert("Error", err.message || "Failed to submit assignment.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewSubmission = async () => {
        const fileUrl = assignment.submission?.file_url;
        if (!fileUrl) {
            Alert.alert("Error", "No file found for this submission.");
            return;
        }

        try {
            if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
                openFileViewer(fileUrl, assignment.title + " Submission");
            } else {
                const { data } = supabase.storage.from('class-materials').getPublicUrl(fileUrl);
                if (data?.publicUrl) {
                    openFileViewer(data.publicUrl, assignment.title + " Submission");
                }
            }
        } catch (err) {
            console.error("View submission error:", err);
            Alert.alert("Error", "Could not open submission URL.");
        }
    };

    const handleUndoSubmit = async () => {
        Alert.alert(
            "Undo Submission",
            "Are you sure you want to undo your submission? This will delete your submitted file and return the task to the Upcoming tab.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Yes, Undo",
                    style: "destructive",
                    onPress: async () => {
                        setIsSubmitting(true);
                        try {
                            const { data: userData } = await supabase.auth.getUser();
                            const userId = userData.user?.id;
                            if (!userId) throw new Error("User not authenticated");



                            // 2. Delete from teacher_assessment_submissions
                            const { error: deleteTeacherSubError } = await supabase
                                .from('teacher_assessment_submissions')
                                .delete()
                                .eq('assessment_id', assignment.id)
                                .eq('student_id', userId);

                            if (deleteTeacherSubError) {
                                throw deleteTeacherSubError;
                            }

                            // 3. Delete record from teacher_assessment_grades to revert status to pending
                            const { error: deleteGradeError } = await supabase
                                .from('teacher_assessment_grades')
                                .delete()
                                .eq('assessment_id', assignment.id)
                                .eq('student_id', userId);

                            if (deleteGradeError) {
                                throw deleteGradeError;
                            }

                            let targetTab = "upcoming";
                            if (assignment.dueDate && assignment.dueDate !== "TBA") {
                                const parsedDueDate = new Date(assignment.dueDate);
                                parsedDueDate.setHours(23, 59, 59, 999);
                                if (!isNaN(parsedDueDate.getTime()) && parsedDueDate < new Date()) {
                                    targetTab = "late";
                                }
                            }

                            Alert.alert(
                                "Submission Undone", 
                                "Your submission has been undone successfully.",
                                [{ text: "OK", onPress: async () => {
                                    await queryClient.invalidateQueries({ queryKey: ['my-assignments'] });
                                    onBack(targetTab);
                                }}]
                            );
                        } catch (err: any) {
                            console.error("Undo submit error:", err);
                            Alert.alert("Error", err.message || "Failed to undo submission.");
                        } finally {
                            setIsSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    const handleDownloadAssignment = async () => {
        let fileUrl = assignment.file_url;
        // Handle arrays - extract first element
        if (Array.isArray(fileUrl)) {
            fileUrl = fileUrl[0];
        }
        if (!fileUrl || typeof fileUrl !== 'string') return;
        try {
            if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
                openFileViewer(fileUrl, assignment.file_name || "Assignment Attachment");
            } else {
                let cleanPath = fileUrl;
                if (cleanPath.startsWith('class-materials/')) {
                    cleanPath = cleanPath.replace('class-materials/', '');
                }
                const { data } = supabase.storage.from('class-materials').getPublicUrl(cleanPath);
                if (data?.publicUrl) {
                    openFileViewer(data.publicUrl, assignment.file_name || "Assignment Attachment");
                }
            }
        } catch(e) {
            console.error(e);
            Alert.alert("Error", "Could not open the assignment material.");
        }
    };

    const isImage = !!(pickedFile?.mimeType?.startsWith('image/') || pickedFile?.name?.match(/\.(jpg|jpeg|png)$/i));
    const instructionsStr = typeof assignment.instructions === 'string' ? assignment.instructions : String(assignment.instructions || '');
    const parsedQuiz = quizData;
    const isSubmitDisabled = (() => {
        if (isSubmitting) return true;
        if (pickedFile) return false;
        
        if (assignment.assessment_type === 'quiz') {
            if (parsedQuiz) {
                const unansweredCount = parsedQuiz.questions.filter(q => {
                    const ans = selectedAnswers[q.questionNumber];
                    return !ans || (typeof ans === 'string' && !ans.trim());
                }).length;
                return unansweredCount > 0;
            }
            return !responseText.trim();
        } else {
            return !responseText.trim();
        }
    })();

    return (
        <View style={styles.detailedContainer}>
            <AppHeader title={assignment.title} showBack={true} onBack={onBack} />
            
            <ScrollView contentContainerStyle={styles.detailedContent}>
                <View style={styles.detailHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.detailTitle}>{assignment.title}</Text>
                        <View style={{ 
                            backgroundColor: assignment.assessment_type === 'quiz' ? '#EFF6FF' : '#F0FDF4', 
                            paddingHorizontal: 8, 
                            paddingVertical: 2, 
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: assignment.assessment_type === 'quiz' ? '#BFDBFE' : '#BBF7D0',
                            alignSelf: 'flex-start',
                            marginTop: 4
                        }}>
                            <Text style={{ 
                                fontSize: 10, 
                                fontWeight: 'bold', 
                                color: assignment.assessment_type === 'quiz' ? '#1E40AF' : '#166534',
                                textTransform: 'uppercase'
                            }}>
                                {assignment.assessment_type || 'task'}
                            </Text>
                        </View>
                    </View>
                    <StatusBadge status={assignment.status} />
                </View>

                <View style={styles.instructionsContainer}>
                    <Text style={styles.sectionTitle}>
                        {assignment.assessment_type === 'quiz' ? 'Quiz Questions' : 
                         assignment.assessment_type === 'activity' ? 'Activity Instructions' : 'Instructions'}
                    </Text>
                    <Text style={styles.instructionsText}>
                        {parsedQuiz ? (parsedQuiz.instructionsHeader || "Please answer the multiple-choice questions below.") : (instructionsStr || "Please complete the attached assignment and upload your work here. Ensure all requirements are met before submitting.")}
                    </Text>

                    {(() => {
                        const mediaList: { url: string; fileName: string; isImage: boolean }[] = [];
                        const addedUrls = new Set<string>();

                        const resolveUrl = (rawUrl: any): string | null => {
                            if (!rawUrl) return null;
                            let target = rawUrl;
                            if (Array.isArray(target)) target = target[0];
                            if (typeof target === 'string') {
                                let trimmed = target.trim();
                                if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
                                    trimmed = trimmed.slice(1, -1).trim();
                                }
                                if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                                    try {
                                        const parsed = JSON.parse(trimmed);
                                        if (Array.isArray(parsed) && parsed.length > 0) {
                                            target = parsed[0];
                                        } else if (parsed && typeof parsed === 'object') {
                                            target = parsed.url || parsed.file_url || parsed.publicUrl || parsed.path || target;
                                        }
                                    } catch (e) {}
                                }
                                if (typeof target === 'string') target = target.trim();
                            }

                            if (!target || typeof target !== 'string') return null;
                            let clean = target.trim();
                            if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
                                clean = clean.slice(1, -1).trim();
                            }
                            if (!clean) return null;

                            if (clean.startsWith('http://') || clean.startsWith('https://')) {
                                return clean;
                            }

                            if (clean.startsWith('/storage/v1/object/public/')) {
                                const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://replace-this.supabase.co";
                                return `${baseUrl.replace(/\/$/, '')}${clean}`;
                            }

                            let bucket = 'class-materials';
                            let path = clean;
                            if (clean.startsWith('class-materials/')) {
                                bucket = 'class-materials';
                                path = clean.replace(/^class-materials\//, '');
                            } else if (clean.startsWith('announcement-images/')) {
                                bucket = 'announcement-images';
                                path = clean.replace(/^announcement-images\//, '');
                            } else if (clean.startsWith('message-attachments/')) {
                                bucket = 'message-attachments';
                                path = clean.replace(/^message-attachments\//, '');
                            }

                            const { data } = supabase.storage.from(bucket).getPublicUrl(path);
                            return data?.publicUrl || clean;
                        };

                        const isImageExt = (url: string, name: string) => {
                            const lowerUrl = (url || '').toLowerCase();
                            const lowerName = (name || '').toLowerCase();
                            
                            // Exclude document extensions
                            const docExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip', '.rar', '.csv'];
                            if (docExts.some(ext => lowerUrl.includes(ext) || lowerName.endsWith(ext))) {
                                return false;
                            }

                            const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', 'image', 'photo', 'img', 'picture', 'pic'];
                            return imageExts.some(ext => lowerUrl.includes(ext) || lowerName.includes(ext));
                        };

                        // 1. From assignment.file_url / file_name (handles single string, arrays, or JSON arrays)
                        if (assignment.file_url) {
                            const parseAllUrls = (raw: any): { url: string; fileName: string }[] => {
                                const list: { url: string; fileName: string }[] = [];
                                let targets: any[] = [];
                                if (Array.isArray(raw)) {
                                    targets = raw;
                                } else if (typeof raw === 'string') {
                                    let trimmed = raw.trim();
                                    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
                                        trimmed = trimmed.slice(1, -1).trim();
                                    }
                                    if (trimmed.startsWith('[')) {
                                        try {
                                            const parsed = JSON.parse(trimmed);
                                            if (Array.isArray(parsed)) targets = parsed;
                                            else targets = [trimmed];
                                        } catch (e) {
                                            targets = [trimmed];
                                        }
                                    } else {
                                        targets = [trimmed];
                                    }
                                } else if (raw) {
                                    targets = [raw];
                                }

                                targets.forEach((t, i) => {
                                    const res = resolveUrl(t);
                                    if (res) {
                                        let name = assignment.file_name || "Teacher Attachment";
                                        if (Array.isArray(assignment.file_name)) {
                                            name = assignment.file_name[i] || assignment.file_name[0] || name;
                                        } else if (typeof assignment.file_name === 'string' && assignment.file_name.trim().startsWith('[')) {
                                            try {
                                                const parsedNames = JSON.parse(assignment.file_name.trim());
                                                if (Array.isArray(parsedNames)) name = parsedNames[i] || parsedNames[0] || name;
                                            } catch (e) {}
                                        }
                                        list.push({ url: res, fileName: String(name) });
                                    }
                                });
                                return list;
                            };

                            const items = parseAllUrls(assignment.file_url);
                            items.forEach(item => {
                                if (!addedUrls.has(item.url)) {
                                    addedUrls.add(item.url);
                                    mediaList.push({
                                        url: item.url,
                                        fileName: item.fileName,
                                        isImage: isImageExt(item.url, item.fileName)
                                    });
                                }
                            });
                        }

                        // 2. Extract image & storage URLs embedded in instructions
                        if (instructionsStr) {
                            // Markdown image syntax
                            const mdRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi;
                            let match;
                            while ((match = mdRegex.exec(instructionsStr)) !== null) {
                                const matchedUrl = resolveUrl(match[1]);
                                if (matchedUrl && !addedUrls.has(matchedUrl)) {
                                    addedUrls.add(matchedUrl);
                                    mediaList.push({ url: matchedUrl, fileName: "Instruction Picture", isImage: true });
                                }
                            }
                            // Direct URLs with image extensions
                            const urlRegex = /(https?:\/\/[^\s<>\"]+?\.(?:jpg|jpeg|png|gif|webp|bmp|svg)(?:\?[^\s<>\"]*)?)/gi;
                            while ((match = urlRegex.exec(instructionsStr)) !== null) {
                                const matchedUrl = match[1].trim();
                                if (!addedUrls.has(matchedUrl)) {
                                    addedUrls.add(matchedUrl);
                                    mediaList.push({ url: matchedUrl, fileName: "Instruction Picture", isImage: true });
                                }
                            }
                            // Supabase storage public URLs
                            const storageRegex = /(https?:\/\/[^\s<>\"]+?\/storage\/v1\/object\/public\/[^\s<>\"]+)/gi;
                            while ((match = storageRegex.exec(instructionsStr)) !== null) {
                                const matchedUrl = match[1].trim();
                                if (!addedUrls.has(matchedUrl)) {
                                    addedUrls.add(matchedUrl);
                                    mediaList.push({ url: matchedUrl, fileName: "Instruction Attachment", isImage: isImageExt(matchedUrl, '') });
                                }
                            }
                        }

                        // 3. Fallback: If instructions mention "pdf", "file", "attachment", or "picture", ensure card is rendered
                        if (mediaList.length === 0 && instructionsStr) {
                            const lowerInst = instructionsStr.toLowerCase();
                            if (lowerInst.includes('pdf') || lowerInst.includes('file') || lowerInst.includes('attachment') || lowerInst.includes('picture') || lowerInst.includes('image') || lowerInst.includes('read')) {
                                const isImg = lowerInst.includes('picture') || lowerInst.includes('image') || lowerInst.includes('photo');
                                mediaList.push({
                                    url: (assignment as any).file_url || "#",
                                    fileName: lowerInst.includes('pdf') ? "Assignment_Instructions.pdf" : (isImg ? "Instruction_Picture.png" : "Attached_Reference_File"),
                                    isImage: isImg
                                });
                            }
                        }

                        if (mediaList.length === 0) return null;

                        return (
                            <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 12 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155' }}>
                                    {mediaList.some(m => m.isImage) ? '📷 Attached Picture / Material' : '📎 Attached Reference Material'}
                                </Text>

                                {mediaList.map((item, idx) => (
                                    <View key={idx}>
                                        {item.isImage ? (
                                            <TouchableOpacity 
                                                activeOpacity={0.9} 
                                                onPress={() => openFileViewer(item.url, item.fileName)}
                                                style={{
                                                    borderRadius: 12,
                                                    overflow: 'hidden',
                                                    backgroundColor: '#F1F5F9',
                                                    borderWidth: 1,
                                                    borderColor: '#CBD5E1',
                                                }}
                                            >
                                                <Image 
                                                    source={{ uri: item.url }}
                                                    style={{ width: '100%', height: 250, borderRadius: 12 }}
                                                    resizeMode="contain"
                                                />
                                                <View style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 10,
                                                    backgroundColor: '#F8FAFC',
                                                    borderTopWidth: 1,
                                                    borderTopColor: '#E2E8F0'
                                                }}>
                                                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B', flex: 1 }} numberOfLines={1}>
                                                        {item.fileName}
                                                    </Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                        <Text style={{ fontSize: 12, color: Colors.light.primary, fontWeight: 'bold' }}>
                                                            View Full
                                                        </Text>
                                                        <Ionicons name="eye-outline" size={14} color={Colors.light.primary} />
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity 
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    backgroundColor: '#EFF6FF',
                                                    padding: 14,
                                                    borderRadius: 12,
                                                    borderWidth: 1.5,
                                                    borderColor: '#93C5FD',
                                                    marginTop: 6
                                                }}
                                                onPress={() => openFileViewer(item.url, item.fileName)}
                                            >
                                                <Ionicons name="document-text-outline" size={30} color={Colors.light.primary} />
                                                <View style={{ flex: 1, marginLeft: 12 }}>
                                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1E293B' }} numberOfLines={1}>
                                                        {item.fileName}
                                                    </Text>
                                                    <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '600', marginTop: 2 }}>
                                                        📄 Tap to Open
                                                    </Text>
                                                </View>
                                                <Ionicons name="eye-outline" size={22} color={Colors.light.primary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>
                        );
                    })()}
                </View>

                {(assignment.status === "pending" || assignment.status === "late") && !hasAttemptedQuiz ? (
                    <View style={styles.submissionSection}>
                        <Text style={styles.sectionTitle}>
                            {assignment.assessment_type === 'quiz' ? 'Quiz Assessment' : 'Your Submission'}
                        </Text>
                        
                        {(assignment.assessment_type === 'quiz') && !isQuizStarted ? (
                            <View style={{ marginVertical: 12, alignItems: 'center', backgroundColor: '#F8FAFC', padding: 20, borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0' }}>
                                <Ionicons name="clipboard-outline" size={42} color={Colors.light.primary} style={{ marginBottom: 8 }} />
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0F172A', textAlign: 'center' }}>
                                    Ready to Take Quiz?
                                </Text>
                                <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
                                    Please review the instructions and reference materials above before starting.
                                </Text>
                                <TouchableOpacity 
                                    style={{
                                        backgroundColor: Colors.light.primary,
                                        paddingVertical: 14,
                                        paddingHorizontal: 28,
                                        borderRadius: 12,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        justifyContent: 'center',
                                        elevation: 3,
                                        shadowColor: Colors.light.primary,
                                        shadowOffset: { width: 0, height: 3 },
                                        shadowOpacity: 0.25,
                                        shadowRadius: 5
                                    }}
                                    onPress={() => setIsQuizStarted(true)}
                                >
                                    <Ionicons name="play-circle-outline" size={24} color="#FFFFFF" />
                                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                                        Start Quiz {parsedQuiz ? `(${parsedQuiz.questions.length} Items)` : ''}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                {parsedQuiz ? (
                                    <View style={styles.quizFormContainer}>
                                        {parsedQuiz.questions.map((q: any) => {
                                            const selectedOpt = selectedAnswers[q.questionNumber];
                                            const showTextInput = q.questionType === 'Identification' || q.questionType === 'Short Answer' || q.questionType === 'Essay';
                                            
                                            return (
                                                <View key={q.questionNumber} style={styles.quizQuestionCard}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                        <Text style={styles.quizQuestionText}>
                                                            {q.questionNumber}. {q.questionText}
                                                        </Text>
                                                        <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>
                                                            {q.points || 1} pts
                                                        </Text>
                                                    </View>
                                                    
                                                    {showTextInput ? (
                                                        <TextInput
                                                            style={[
                                                                styles.quizTextInput,
                                                                { minHeight: q.questionType === 'Essay' ? 100 : 50 }
                                                            ]}
                                                            value={selectedOpt || ""}
                                                            onChangeText={(text) => {
                                                                    setSelectedAnswers(prev => ({
                                                                        ...prev,
                                                                        [q.questionNumber]: text
                                                                    }));
                                                            }}
                                                            placeholder={q.questionType === 'Essay' ? "Write your essay response here..." : "Type your answer here..."}
                                                            multiline={q.questionType === 'Essay' || q.questionType === 'Short Answer'}
                                                            textAlignVertical={q.questionType === 'Essay' ? 'top' : 'center'}
                                                        />
                                                    ) : (
                                                        <View style={styles.quizOptionsContainer}>
                                                            {q.options.map((opt: any) => {
                                                                const isSelected = selectedOpt === opt.label;
                                                                return (
                                                                    <TouchableOpacity
                                                                        key={opt.label}
                                                                        style={[
                                                                            styles.quizOptionButton,
                                                                            isSelected && styles.quizOptionButtonSelected
                                                                        ]}
                                                                        onPress={() => {
                                                                            setSelectedAnswers(prev => ({
                                                                                ...prev,
                                                                                [q.questionNumber]: opt.label
                                                                            }));
                                                                        }}
                                                                    >
                                                                        <View style={[
                                                                            styles.quizOptionLetterCircle,
                                                                            isSelected && styles.quizOptionLetterCircleSelected
                                                                        ]}>
                                                                            <Text style={[
                                                                                styles.quizOptionLetterText,
                                                                                isSelected && styles.quizOptionLetterTextSelected
                                                                            ]}>
                                                                                {opt.label}
                                                                            </Text>
                                                                        </View>
                                                                        <Text style={[
                                                                            styles.quizOptionText,
                                                                            isSelected && styles.quizOptionTextSelected
                                                                        ]}>
                                                                            {opt.text}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <View style={styles.responseBox}>
                                        <Text style={styles.inputLabel}>
                                            {assignment.assessment_type === 'quiz' ? 'Write your answers here:' : 'Answer / Response Text:'}
                                        </Text>
                                        <TextInput
                                            style={styles.textInputResponse}
                                            placeholder={assignment.assessment_type === 'quiz' ? "Enter your quiz answers here..." : "Type your answer or response here..."}
                                            placeholderTextColor="#94A3B8"
                                            multiline
                                            numberOfLines={6}
                                            value={responseText}
                                            onChangeText={setResponseText}
                                        />
                                    </View>
                                )}
                            </>
                        )}

                        <Text style={styles.inputLabel}>Attachments (Optional):</Text>
                        <View style={styles.uploadWrapper}>
                            <FileUploadComponent
                                onPickFile={handleFileUpload}
                                onRemoveFile={() => setPickedFile(null)}
                                fileName={pickedFile?.name}
                                fileUri={pickedFile?.uri}
                                fileType={pickedFile?.mimeType}
                            />
                        </View>

                        {!pickedFile && (
                            <View style={styles.attachmentButtonsRow}>
                                <TouchableOpacity style={styles.attachBtn} onPress={() => handleImageUpload(false)}>
                                    <Ionicons name="image-outline" size={16} color={Colors.light.primary} />
                                    <Text style={styles.attachBtnText}>Upload Image</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.attachBtn} onPress={() => handleImageUpload(true)}>
                                    <Ionicons name="camera-outline" size={16} color={Colors.light.primary} />
                                    <Text style={styles.attachBtnText}>Take Photo</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <Button 
                            title={isSubmitting ? "Submitting..." : "Submit"} 
                            onPress={handleSubmit}
                            disabled={isSubmitDisabled}
                        />
                    </View>
                ) : (() => {
                    let submissionData: any = null;
                    const responseText_ = assignment.submission?.response_text || (quizAttemptData && quizAttemptData.response_text);
                    if (typeof responseText_ === 'string' && responseText_.startsWith("DATA_JSON:")) {
                        try {
                            submissionData = JSON.parse(responseText_.substring(10));
                        } catch (e) {
                            console.error("Failed to parse DATA_JSON:", e);
                        }
                    } else if ((hasAttemptedQuiz || assignment.assessment_type === 'quiz') && (quizAttemptData || (assignment.submission?.grade !== null && assignment.submission?.grade !== undefined))) {
                        const score_ = quizAttemptData?.score ?? assignment.submission?.grade ?? 0;
                        const answers_ = quizAttemptData?.answers ?? {};
                        const questions_ = quizData?.questions || [];
                        let cCount = 0;
                        questions_.forEach((q: any) => {
                            const studentAns = answers_[q.questionNumber];
                            let isCorrect = false;
                            if (q.questionType === 'Multiple Choice' || q.questionType === 'True/False') {
                                isCorrect = studentAns === q.correctAnswer;
                            } else if (q.questionType === 'Identification' || q.questionType === 'Short Answer') {
                                isCorrect = String(studentAns || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase();
                            }
                            if (isCorrect) cCount++;
                        });
                        submissionData = {
                            score: score_,
                            correctCount: cCount || Math.round((score_ / 100) * (questions_.length || 1)),
                            totalQuestions: questions_.length || 1,
                            answers: answers_,
                            questions: questions_
                        };
                    }

                    return (
                        <View style={styles.submissionSection}>
                             <Text style={styles.sectionTitle}>Submission Complete</Text>
                             
                             {submissionData ? (
                                 <View style={styles.resultsDashboardContainer}>
                                     <View style={styles.scoreCard}>
                                         <View style={{ flex: 1 }}>
                                             <Text style={styles.scoreCardTitle}>Quiz Results</Text>
                                             <Text style={styles.scoreCardText}>
                                                 You scored <Text style={{fontWeight: 'bold', color: Colors.light.primary}}>{submissionData.score}%</Text> ({submissionData.correctCount} of {submissionData.totalQuestions} correct)
                                             </Text>
                                         </View>
                                         <View style={styles.scoreBadge}>
                                             <Text style={styles.scoreBadgeText}>{submissionData.score}%</Text>
                                         </View>
                                     </View>
                                     
                                     <Text style={styles.reviewTitle}>Question Review</Text>
                                     {submissionData.questions && submissionData.questions.map((q: any) => {
                                          const studentAns = submissionData.answers[q.questionNumber];
                                          const showTextInput = q.questionType === 'Identification' || q.questionType === 'Short Answer' || q.questionType === 'Essay';
                                          
                                          let isCorrect = false;
                                          if (q.questionType === 'Multiple Choice' || q.questionType === 'True/False') {
                                              isCorrect = studentAns === q.correctAnswer;
                                          } else if (q.questionType === 'Identification' || q.questionType === 'Short Answer') {
                                              isCorrect = String(studentAns || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase();
                                          }

                                          return (
                                              <View key={q.questionNumber} style={[
                                                  styles.reviewQuestionCard,
                                                  isCorrect ? styles.reviewQuestionCardCorrect : styles.reviewQuestionCardIncorrect
                                              ]}>
                                                  <View style={styles.reviewQuestionHeader}>
                                                      <Text style={styles.reviewQuestionText}>
                                                          {q.questionNumber}. {q.questionText}
                                                      </Text>
                                                      <Ionicons 
                                                          name={isCorrect ? "checkmark-circle" : "close-circle"} 
                                                          size={24} 
                                                          color={isCorrect ? "#16A34A" : "#DC2626"} 
                                                      />
                                                  </View>
                                                  
                                                  {showTextInput ? (
                                                      <View style={{ marginTop: 8 }}>
                                                          <View style={{
                                                              backgroundColor: isCorrect ? '#F0FDF4' : '#FEF2F2',
                                                              padding: 12,
                                                              borderRadius: 8,
                                                              borderWidth: 1,
                                                              borderColor: isCorrect ? '#BBF7D0' : '#FCA5A5',
                                                              marginBottom: 8
                                                          }}>
                                                              <Text style={{ fontSize: 13, color: '#475569', fontWeight: 'bold' }}>Your Answer:</Text>
                                                              <Text style={{ fontSize: 14, color: isCorrect ? '#166534' : '#991B1B', marginTop: 2, fontWeight: '600' }}>
                                                                  {studentAns || "(No Answer)"}
                                                              </Text>
                                                          </View>
                                                          {(!isCorrect && q.correctAnswer) && (
                                                              <View style={{
                                                                  backgroundColor: '#F0FDF4',
                                                                  padding: 12,
                                                                  borderRadius: 8,
                                                                  borderWidth: 1,
                                                                  borderColor: '#BBF7D0'
                                                              }}>
                                                                  <Text style={{ fontSize: 13, color: '#475569', fontWeight: 'bold' }}>Correct Answer:</Text>
                                                                  <Text style={{ fontSize: 14, color: '#166534', marginTop: 2, fontWeight: '600' }}>
                                                                      {q.correctAnswer}
                                                                  </Text>
                                                              </View>
                                                          )}
                                                      </View>
                                                  ) : (
                                                      <View style={styles.reviewOptionsContainer}>
                                                          {q.options && q.options.map((opt: any) => {
                                                              const isStudentSelect = studentAns === opt.label;
                                                              const isCorrectAns = q.correctAnswer === opt.label;
                                                              
                                                              let optStyle = {};
                                                              let textStyle = {};
                                                              let circleStyle = {};
                                                              let circleTextStyle = {};
                                                              
                                                              if (isStudentSelect) {
                                                                  if (isCorrect) {
                                                                      optStyle = styles.optStudentCorrect;
                                                                      textStyle = { color: "#166534", fontWeight: "600" };
                                                                      circleStyle = { backgroundColor: "#BBF7D0", borderColor: "#16A34A" };
                                                                      circleTextStyle = { color: "#15803D" };
                                                                  } else {
                                                                      optStyle = styles.optStudentIncorrect;
                                                                      textStyle = { color: "#991B1B", fontWeight: "600" };
                                                                      circleStyle = { backgroundColor: "#FEE2E2", borderColor: "#DC2626" };
                                                                      circleTextStyle = { color: "#B91C1C" };
                                                                  }
                                                              } else if (isCorrectAns) {
                                                                  optStyle = styles.optCorrectTarget;
                                                                  textStyle = { color: "#166534", fontWeight: "600" };
                                                                  circleStyle = { backgroundColor: "#BBF7D0", borderColor: "#16A34A" };
                                                                  circleTextStyle = { color: "#15803D" };
                                                              }
                                                              
                                                              return (
                                                                  <View
                                                                      key={opt.label}
                                                                      style={[styles.reviewOptionRow, optStyle]}
                                                                  >
                                                                      <View style={[styles.reviewOptionCircle, circleStyle]}>
                                                                          <Text style={[styles.reviewOptionCircleText, circleTextStyle]}>
                                                                              {opt.label}
                                                                          </Text>
                                                                      </View>
                                                                      <Text style={[styles.reviewOptionText, textStyle]}>
                                                                          {opt.text}
                                                                      </Text>
                                                                      {isStudentSelect && (
                                                                          <Text style={[
                                                                              styles.yourAnswerTag,
                                                                              isCorrect ? { color: "#15803D" } : { color: "#B91C1C" }
                                                                          ]}>
                                                                              (Your Answer)
                                                                          </Text>
                                                                      )}
                                                                      {!isCorrect && isCorrectAns && (
                                                                          <Text style={{ color: "#15803D", fontSize: 11, fontWeight: "600", marginLeft: "auto" }}>
                                                                              (Correct Answer)
                                                                          </Text>
                                                                      )}
                                                                  </View>
                                                              );
                                                          })}
                                                      </View>
                                                  )}
                                              </View>
                                          );
                                      })}
                                 </View>
                             ) : (
                                 <>
                                      <View style={styles.submittedInfo}>
                                         <Ionicons name="checkmark-circle" size={48} color={Colors.light.primary} />
                                         <Text style={styles.submittedText}>You have successfully submitted this assignment.</Text>
                                      </View>

                                      {assignment.submission?.response_text && (
                                          <View style={styles.feedbackContainer}>
                                              <Text style={styles.feedbackTitle}>Your Answer / Response:</Text>
                                              <Text style={styles.feedbackText}>{assignment.submission.response_text}</Text>
                                          </View>
                                      )}
                                 </>
                             )}

                             {assignment.submission?.grade !== null && assignment.submission?.grade !== undefined && (
                                 <View style={styles.feedbackContainer}>
                                     <Text style={styles.feedbackTitle}>Grade: {String(assignment.submission.grade)}</Text>
                                 </View>
                             )}
                             {assignment.submission?.teacher_comment && (
                                 <View style={styles.feedbackContainer}>
                                     <Text style={styles.feedbackTitle}>Teacher's Comment:</Text>
                                     <Text style={styles.feedbackText}>{assignment.submission.teacher_comment}</Text>
                                 </View>
                             )}

                             {assignment.submission?.file_url && 
                             assignment.submission.file_url !== "quiz-submission" && 
                             assignment.submission.file_url !== "text-only-submission" && (
                                  <Button 
                                      title="View My Work" 
                                      onPress={handleViewSubmission}
                                      variant="secondary"
                                  />
                             )}
                             {(!assignment.submission?.grade) && assignment.assessment_type !== 'quiz' && (
                                  <TouchableOpacity 
                                      style={{ 
                                          marginTop: 12, 
                                          padding: 12, 
                                          alignItems: 'center', 
                                          backgroundColor: '#FEF2F2', 
                                          borderRadius: 8, 
                                          borderWidth: 1, 
                                          borderColor: '#FCA5A5' 
                                      }}
                                      onPress={handleUndoSubmit}
                                  >
                                      <Text style={{ color: '#DC2626', fontWeight: 'bold', fontSize: 16 }}>Undo Submit</Text>
                                  </TouchableOpacity>
                              )}
                        </View>
                    );
                })()}
            </ScrollView>

            {/* ══ DEDICATED QUIZ PLAYER POP-UP MODAL ══ */}
            <Modal 
                visible={isQuizStarted} 
                animationType="slide" 
                presentationStyle="fullScreen"
                onRequestClose={() => {
                    Alert.alert(
                        "Exit Quiz?",
                        "Are you sure you want to exit? Any unsubmitted answers will not be saved.",
                        [
                            { text: "Continue Quiz", style: "cancel" },
                            { text: "Exit", style: "destructive", onPress: () => setIsQuizStarted(false) }
                        ]
                    );
                }}
            >
                <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                    {/* Quiz Modal Header */}
                    <View style={{
                        backgroundColor: Colors.light.primary,
                        paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 44,
                        paddingBottom: 16,
                        paddingHorizontal: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 4,
                        elevation: 4
                    }}>
                        <TouchableOpacity 
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} 
                            onPress={() => {
                                Alert.alert(
                                    "Exit Quiz?",
                                    "Are you sure you want to exit? Any unsubmitted answers will not be saved.",
                                    [
                                        { text: "Continue Quiz", style: "cancel" },
                                        { text: "Exit", style: "destructive", onPress: () => setIsQuizStarted(false) }
                                    ]
                                );
                            }}
                        >
                            <Ionicons name="close" size={26} color="#FFFFFF" />
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15 }}>Close</Text>
                        </TouchableOpacity>

                        <View style={{ alignItems: 'center', flex: 1, marginHorizontal: 12 }}>
                            <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' }} numberOfLines={1}>
                                {assignment.title || "Quiz"}
                            </Text>
                            <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 12 }}>
                                {parsedQuiz ? `${parsedQuiz.questions.length} Question Items` : 'Quiz Assessment'}
                            </Text>
                        </View>

                        <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>
                                {assignment.subject || "Quiz"}
                            </Text>
                        </View>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
                        {/* Instruction Banner inside Quiz Player */}
                        <View style={{
                            backgroundColor: '#FFFFFF',
                            padding: 16,
                            borderRadius: 14,
                            marginBottom: 16,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            borderLeftWidth: 5,
                            borderLeftColor: Colors.light.primary
                        }}>
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 }}>
                                Instructions
                            </Text>
                            <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20 }}>
                                {instructionsStr || "Please read the questions provided below and select your answers."}
                            </Text>
                        </View>

                        {/* Combined Teacher Questions Sheet (Image / Document) */}
                        {(() => {
                            let urlStr = Array.isArray(assignment.file_url) ? assignment.file_url[0] : assignment.file_url;
                            if (!urlStr || typeof urlStr !== 'string') return null;
                            let publicUrl = urlStr;
                            if (!publicUrl.startsWith('http://') && !publicUrl.startsWith('https://')) {
                                const cleanPath = publicUrl.replace(/^class-materials\//, '');
                                const { data } = supabase.storage.from('class-materials').getPublicUrl(cleanPath);
                                publicUrl = data?.publicUrl || publicUrl;
                            }
                            const isImg = urlStr.match(/\.(jpg|jpeg|png|webp)$/i) || publicUrl.match(/\.(jpg|jpeg|png|webp)$/i);

                            return (
                                <View style={{
                                    marginBottom: 18,
                                    borderRadius: 14,
                                    overflow: 'hidden',
                                    borderWidth: 1.5,
                                    borderColor: '#93C5FD',
                                    backgroundColor: '#FFFFFF',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.08,
                                    shadowRadius: 4,
                                    elevation: 2
                                }}>
                                    <View style={{
                                        backgroundColor: '#EFF6FF',
                                        paddingHorizontal: 14,
                                        paddingVertical: 10,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#BFDBFE',
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="document-text-outline" size={18} color={Colors.light.primary} />
                                            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1E293B' }}>
                                                Teacher's Quiz Question Sheet
                                            </Text>
                                        </View>
                                        <TouchableOpacity 
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                            onPress={() => {
                                                openFileViewer(publicUrl, assignment.file_name || "Teacher's Quiz Sheet");
                                            }}
                                        >
                                            <Text style={{ fontSize: 12, color: Colors.light.primary, fontWeight: 'bold' }}>Open Full</Text>
                                            <Ionicons name="open-outline" size={14} color={Colors.light.primary} />
                                        </TouchableOpacity>
                                    </View>

                                    {isImg ? (
                                        <TouchableOpacity 
                                            activeOpacity={0.9} 
                                            onPress={() => openFileViewer(publicUrl, assignment.file_name || "Teacher's Quiz Sheet")}
                                        >
                                            <Image 
                                                source={{ uri: publicUrl }}
                                                style={{ width: '100%', height: 350, backgroundColor: '#F8FAFC' }}
                                                resizeMode="contain"
                                            />
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity 
                                            style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FAFAFA' }}
                                            onPress={() => {
                                                openFileViewer(publicUrl, assignment.file_name || "Questions Document / PDF");
                                            }}
                                        >
                                            <Ionicons name="document-attach" size={32} color={Colors.light.primary} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0F172A' }}>
                                                    {assignment.file_name || "Questions Document / PDF"}
                                                </Text>
                                                <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '600', marginTop: 2 }}>
                                                    Tap to view teacher's question document
                                                </Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })()}

                        {/* Questions area */}
                        {parsedQuiz && (
                            <View style={styles.quizFormContainer}>
                                {parsedQuiz.questions.map((q) => {
                                    const selectedOpt = selectedAnswers[q.questionNumber];
                                    return (
                                        <View key={q.questionNumber} style={styles.quizQuestionCard}>
                                            <Text style={styles.quizQuestionText}>
                                                {q.questionNumber}. {q.questionText}
                                            </Text>
                                            <View style={styles.quizOptionsContainer}>
                                                {q.options.map((opt) => {
                                                    const isSelected = selectedOpt === opt.label;
                                                    return (
                                                        <TouchableOpacity
                                                            key={opt.label}
                                                            style={[
                                                                styles.quizOptionButton,
                                                                isSelected && styles.quizOptionButtonSelected
                                                            ]}
                                                            onPress={() => {
                                                                setSelectedAnswers(prev => ({
                                                                    ...prev,
                                                                    [q.questionNumber]: opt.label
                                                                }));
                                                            }}
                                                        >
                                                            <View style={[
                                                                styles.quizOptionLetterCircle,
                                                                isSelected && styles.quizOptionLetterCircleSelected
                                                            ]}>
                                                                <Text style={[
                                                                    styles.quizOptionLetterText,
                                                                    isSelected && styles.quizOptionLetterTextSelected
                                                                ]}>
                                                                    {opt.label}
                                                                </Text>
                                                            </View>
                                                            <Text style={[
                                                                styles.quizOptionText,
                                                                isSelected && styles.quizOptionTextSelected
                                                            ]}>
                                                                {opt.text}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Additional Answer Box & File Upload */}
                        <View style={[styles.responseBox, { marginTop: parsedQuiz ? 16 : 0 }]}>
                            <Text style={styles.inputLabel}>
                                {parsedQuiz ? 'Additional Notes / Answers (Optional):' : 'Write your quiz answers here:'}
                            </Text>
                            <TextInput
                                style={styles.textInputResponse}
                                placeholder={parsedQuiz ? "Enter any additional explanations or notes..." : "Enter your quiz answers here..."}
                                placeholderTextColor="#94A3B8"
                                multiline
                                numberOfLines={4}
                                value={responseText}
                                onChangeText={setResponseText}
                            />
                            
                            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Attachments (Optional):</Text>
                            <FileUploadComponent 
                                onPickFile={handleFileUpload} 
                                onRemoveFile={() => setPickedFile(null)}
                                fileName={pickedFile?.name}
                                fileUri={pickedFile?.uri}
                                fileType={pickedFile?.mimeType}
                                style={{ marginBottom: 12 }} 
                            />
                            {!pickedFile && (
                                <View style={styles.attachmentButtonsRow}>
                                    <TouchableOpacity style={styles.attachBtn} onPress={() => handleImageUpload(false)}>
                                        <Ionicons name="image-outline" size={16} color={Colors.light.primary} />
                                        <Text style={styles.attachBtnText}>Upload Image</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.attachBtn} onPress={() => handleImageUpload(true)}>
                                        <Ionicons name="camera-outline" size={16} color={Colors.light.primary} />
                                        <Text style={styles.attachBtnText}>Take Photo</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    {/* Bottom Floating Submit Button in Quiz Modal */}
                    <View style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        backgroundColor: '#FFFFFF',
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        borderTopWidth: 1,
                        borderTopColor: '#E2E8F0',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: -3 },
                        shadowOpacity: 0.1,
                        shadowRadius: 5,
                        elevation: 8
                    }}>
                        <Button
                            title={isSubmitting ? "Submitting Quiz..." : "Submit Quiz Answers"}
                            onPress={async () => {
                                await handleSubmit();
                                setIsQuizStarted(false);
                            }}
                            disabled={isSubmitDisabled}
                            loading={isSubmitting}
                            style={{ backgroundColor: isSubmitDisabled ? '#CBD5E1' : Colors.light.primary }}
                        />
                    </View>
                </View>
            </Modal>

            <FileViewerModal 
                visible={viewerVisible} 
                onClose={() => setViewerVisible(false)} 
                url={viewerUrl} 
                fileName={viewerTitle} 
            />
        </View>
    );
};

export default function SubjectAssignments() {
    const segments = useSegments();
    const { id: globalId } = useGlobalSearchParams();
    const { id: localId } = useLocalSearchParams();

    // Improved ID extraction
    const subjectId = (() => {
        if (globalId && globalId !== '[id]' && typeof globalId === 'string') return globalId;
        if (localId && localId !== '[id]' && typeof localId === 'string') return localId;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const found = segments.find(s => uuidRegex.test(s));
        if (found) return found;
        if (segments[2] && segments[2] !== '[id]') return segments[2];
        return localId as string;
    })();
    const [activeTab, setActiveTab] = useState("upcoming");
    const [selectedAssignment, setSelectedAssignment] = useState<any>(null);

    const { data: assignments = [], isLoading, error } = useMyAssignmentsQuery({ subjectId });

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.light.primary} />
            </View>
        );
    }

    // Map tabs to statuses in data
    const filteredAssignments = assignments.filter((a) => {
        if (activeTab === "upcoming") return a.status === "pending" || a.status === "late";
        if (activeTab === "submitted") return ["submitted", "graded", "returned"].includes(a.status);
        return a.status === activeTab;
    });

    console.log(`[assignment UI] subjectId: ${subjectId}, Total: ${assignments.length}, Filtered (${activeTab}): ${filteredAssignments.length}`);

    if (selectedAssignment) {
        return (
            <DetailedAssignmentView 
                assignment={selectedAssignment} 
                onBack={(nextTab?: string) => {
                    setSelectedAssignment(null);
                    if (nextTab) {
                        setActiveTab(nextTab);
                    }
                }} 
            />
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.tabContainer}>
                {[{ id: "upcoming", label: "Upcoming" }, { id: "submitted", label: "Submitted" }, { id: "late", label: "Late" }].map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={[styles.tabButton, isActive && styles.activeTabButton]}
                            onPress={() => setActiveTab(tab.id)}
                        >
                            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <FlatList
                data={filteredAssignments}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.content}
                renderItem={({ item }) => (
                    <AssignmentItem
                        title={item.title}
                        dueDate={item.dueDate}
                        status={item.status}
                        grade={item.submission?.grade}
                        assessmentType={item.assessment_type}
                        onPress={() => setSelectedAssignment(item)}
                    />
                )}
                ListEmptyComponent={() => (
                     <View style={styles.emptyContainer}>
                         <Text style={styles.emptyText}>No {activeTab} assignments found for this subject.</Text>
                     </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    content: {
        padding: Layout.spacing.m,
    },
    tabContainer: {
        flexDirection: "row",
        paddingHorizontal: Layout.spacing.m,
        paddingTop: Layout.spacing.s,
        paddingBottom: Layout.spacing.m,
        backgroundColor: Colors.light.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: "center",
        borderRadius: 20,
    },
    activeTabButton: {
        backgroundColor: Colors.light.primary,
    },
    tabText: {
        fontSize: 14,
        fontWeight: "600",
        color: Colors.light.textSecondary,
    },
    activeTabText: {
        color: "#FFFFFF",
    },
    itemContainer: {
        backgroundColor: "#FFFFFF",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: 1,
        borderColor: "transparent",
    },
    lateItemContainer: {
        backgroundColor: "#FFF0F0",
        borderColor: "#FFCDCD",
    },
    title: {
        fontSize: 16,
        fontWeight: "600",
        color: Colors.light.text,
        marginBottom: 4,
    },
    date: {
        fontSize: 13,
        color: Colors.light.textSecondary,
    },
    lateText: {
        color: Colors.light.error,
    },
    emptyContainer: {
        padding: 40,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        fontSize: 16,
        color: Colors.light.textSecondary,
    },
    detailedContainer: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    detailedContent: {
        padding: Layout.spacing.m,
    },
    detailHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
    },
    detailTitle: {
        fontSize: 22,
        fontWeight: "bold",
        color: Colors.light.text,
        flex: 1,
        marginRight: 16,
    },
    instructionsContainer: {
        backgroundColor: "#FFFFFF",
        padding: 20,
        borderRadius: 12,
        marginBottom: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: Colors.light.text,
        marginBottom: 12,
    },
    instructionsText: {
        fontSize: 15,
        color: Colors.light.textSecondary,
        lineHeight: 22,
    },
    submissionSection: {
        marginTop: 8,
    },
    uploadWrapper: {
        marginBottom: 24,
    },
    submittedInfo: {
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "#F0FAF5",
        borderRadius: 12,
        marginBottom: 16,
    },
    submittedText: {
        fontSize: 15,
        color: Colors.light.textSecondary,
        textAlign: "center",
        marginTop: 12,
        fontWeight: "600",
    },
    fileDownloadCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    fileNameText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
    },
    fileSizeText: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: "#475569",
        marginBottom: 6,
        marginTop: 4,
    },
    responseBox: {
        marginBottom: 16,
    },
    textInputResponse: {
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: "#1E293B",
        backgroundColor: "#F8FAFC",
        textAlignVertical: "top",
        minHeight: 120,
    },
    attachmentButtonsRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 16,
    },
    attachBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F0FAF5",
        borderWidth: 1,
        borderColor: Colors.light.primary,
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 6,
    },
    attachBtnText: {
        fontSize: 12,
        fontWeight: "600",
        color: Colors.light.primary,
    },
    feedbackContainer: {
        backgroundColor: "#F8FAFC",
        padding: 12,
        borderRadius: 8,
        marginTop: 12,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        marginBottom: 12,
    },
    feedbackTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 4,
    },
    feedbackText: {
        fontSize: 14,
        color: "#475569",
        lineHeight: 20,
    },
    quizFormContainer: {
        marginTop: 16,
        marginBottom: 16,
    },
    quizQuestionCard: {
        backgroundColor: "#FFFFFF",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
        elevation: 1,
    },
    quizQuestionText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#1E293B",
        marginBottom: 12,
        lineHeight: 22,
    },
    quizTextInput: {
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        color: "#1E293B",
        backgroundColor: "#F8FAFC",
    },
    quizOptionsContainer: {
        gap: 10,
    },
    quizOptionButton: {
        flexDirection: "row",
        alignItems: "center",
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        backgroundColor: "#F8FAFC",
    },
    quizOptionButtonSelected: {
        borderColor: Colors.light.primary,
        backgroundColor: Colors.light.primary + "08",
    },
    quizOptionLetterCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    quizOptionLetterCircleSelected: {
        backgroundColor: Colors.light.primary,
    },
    quizOptionLetterText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#475569",
    },
    quizOptionLetterTextSelected: {
        color: "#FFFFFF",
    },
    quizOptionText: {
        fontSize: 14,
        color: "#475569",
        flex: 1,
    },
    quizOptionTextSelected: {
        color: Colors.light.primary,
        fontWeight: "600",
    },
    resultsDashboardContainer: {
        marginTop: 8,
        marginBottom: 16,
    },
    scoreCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F0FDF4",
        borderWidth: 1,
        borderColor: "#BBF7D0",
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    scoreCardTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#166534",
    },
    scoreCardText: {
        fontSize: 14,
        color: "#14532D",
        marginTop: 4,
    },
    scoreBadge: {
        backgroundColor: "#16A34A",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginLeft: 12,
    },
    scoreBadgeText: {
        color: "#FFFFFF",
        fontWeight: "bold",
        fontSize: 18,
    },
    reviewTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1E293B",
        marginBottom: 12,
    },
    reviewQuestionCard: {
        backgroundColor: "#FFFFFF",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
    },
    reviewQuestionCardCorrect: {
        borderColor: "#BBF7D0",
    },
    reviewQuestionCardIncorrect: {
        borderColor: "#FCA5A5",
    },
    reviewQuestionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 10,
        marginBottom: 12,
    },
    reviewQuestionText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1E293B",
        flex: 1,
        lineHeight: 20,
    },
    reviewOptionsContainer: {
        gap: 8,
    },
    reviewOptionRow: {
        flexDirection: "row",
        alignItems: "center",
        padding: 10,
        borderRadius: 6,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    reviewOptionCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 10,
        borderWidth: 1,
        borderColor: "transparent",
    },
    reviewOptionCircleText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#475569",
    },
    reviewOptionText: {
        fontSize: 13,
        color: "#475569",
        flex: 1,
    },
    yourAnswerTag: {
        fontSize: 11,
        fontWeight: "600",
        marginLeft: 8,
    },
    optStudentCorrect: {
        backgroundColor: "#F0FDF4",
        borderColor: "#86EFAC",
    },
    optStudentIncorrect: {
        backgroundColor: "#FEF2F2",
        borderColor: "#FCA5A5",
    },
    optCorrectTarget: {
        backgroundColor: "#F0FDF4",
        borderColor: "#86EFAC",
    },
});
