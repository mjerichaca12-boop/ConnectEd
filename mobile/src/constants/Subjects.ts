export interface Subject {
    id: string;
    code: string;
    title: string;
    teacher: string;
    schedule: string;
}

export const subjects: Subject[] = [
    { id: "1", code: "MATH101", title: "Advanced Calculus", teacher: "Dr. Smith", schedule: "Mon/Wed 10:00 AM" },
    { id: "2", code: "CS102", title: "Data Structures", teacher: "Prof. Johnson", schedule: "Tue/Thu 1:00 PM" },
    { id: "3", code: "ENG201", title: "Technical Writing", teacher: "Ms. Davis", schedule: "Fri 9:00 AM" },
    { id: "4", code: "PHYS101", title: "General Physics", teacher: "Dr. Brown", schedule: "Tue/Thu 10:00 AM" },
];
