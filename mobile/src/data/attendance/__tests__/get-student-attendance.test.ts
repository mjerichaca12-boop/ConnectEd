import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStudentAttendance } from "../get-student-attendance";
import { supabase } from "../../../lib/supabase";

vi.mock("../../../lib/supabase", () => {
    const mockFrom = vi.fn((table: string) => {
        if (table === "teacher_student_assignments") {
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({
                        data: [
                            { subject_id: "sub-1", status: "accepted" },
                            { subject_id: "sub-2", status: "active" },
                            { subject_id: "sub-3", status: "rejected" }
                        ],
                        error: null
                    }))
                }))
            };
        }

        if (table === "teacher_student_attendance") {
            return {
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        in: vi.fn(() => ({
                            order: vi.fn(() => Promise.resolve({
                                data: [
                                    { id: 101, attendance_date: "2026-05-19", attendance_status: "Present", subject_id: "sub-1", remarks: "Great job!" }
                                ],
                                error: null
                            }))
                        }))
                    }))
                }))
            };
        }

        if (table === "subjects") {
            return {
                select: vi.fn(() => ({
                    in: vi.fn(() => Promise.resolve({
                        data: [
                            { id: "sub-1", name: "Mathematics", code: "MATH-101" }
                        ],
                        error: null
                    }))
                }))
            };
        }

        return {};
    });

    return {
        supabase: {
            from: mockFrom
        }
    };
});

describe("getStudentAttendance data service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should query only enrolled/active subject IDs and return formatted attendance details", async () => {
        const records = await getStudentAttendance("student-777");

        expect(records.length).toBe(1);
        expect(records[0].subject_name).toBe("Mathematics");
        expect(records[0].subject_code).toBe("MATH-101");
        expect(records[0].status).toBe("Present");
        expect(records[0].remarks).toBe("Great job!");
        expect(supabase.from).toHaveBeenCalledWith("teacher_student_assignments");
        expect(supabase.from).toHaveBeenCalledWith("teacher_student_attendance");
        expect(supabase.from).toHaveBeenCalledWith("subjects");
    });
});
