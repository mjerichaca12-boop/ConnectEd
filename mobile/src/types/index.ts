export interface User {
    id: string;
    name: string;
    email: string;
    role: "student" | "teacher" | "admin";
    avatarUrl?: string;
}

export interface Subject {
    id: string;
    code: string;
    name: string;
    schedule: string;
    teacherId: string;
    teacherName: string;
}

export interface Announcement {
    id: string;
    title: string;
    content: string;
    date: string;
    author: string;
    author_role?: string;
    type: "general" | "urgent" | "event" | "Announcement" | "Assignment" | "Files";
    image_url?: string;
    file_url?: string;
    file_name?: string;
    attachments?: any[];
}

export interface Assignment {
    id: string;
    subjectId: string;
    subject?: string;
    title: string;
    dueDate: string;
    status: "pending" | "submitted" | "late" | "graded" | "returned";
    grade?: number;
    instructions?: string;
    file_url?: string;
    file_name?: string;
    submission?: {
        id: string;
        file_url?: string | null;
        grade?: number;
        teacher_comment?: string;
        status?: string;
    } | null;
}

export interface CalendarEvent {
    id: string;
    date: string;
    title: string;
    type: string;
    description?: string;
    color?: string;
}

export interface Meeting {
    id: string;
    subject: string;
    title: string;
    time: string;
    duration: string;
    subject_id?: string;
    meeting_link?: string;
}

export interface Material {
    id: string;
    title: string;
    type: "pdf" | "doc" | "other";
    date: string;
    file_url?: string;
    subject_id: string;
    description?: string;
}

export type Role = "Student" | "Teacher" | "Admin";

