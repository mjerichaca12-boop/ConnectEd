import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitAssignment } from "../submit-assignment";
import { supabase } from "../../../lib/supabase";

vi.mock("../../../lib/supabase", () => {
    const mockUpload = vi.fn(() => Promise.resolve({ data: {}, error: null }));
    const mockGetPublicUrl = vi.fn((path) => ({ data: { publicUrl: `https://storage.supabase.co/bucket/${path}` } }));
    const mockUpsert = vi.fn(() => ({ error: null }));
    const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
            limit: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: { id: "sub-123", teacher_id: "teacher-456" }, error: null }))
            }))
        }))
    }));

    return {
        supabase: {
            storage: {
                from: vi.fn(() => ({
                    upload: mockUpload,
                    getPublicUrl: mockGetPublicUrl
                }))
            },
            from: vi.fn((table) => {
                if (table === "subjects") {
                    return { select: mockSelect };
                }
                return { upsert: mockUpsert };
            })
        }
    };
});

describe("submitAssignment data service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should successfully upload the file and write to 'teacher_assessment_submissions'", async () => {
        const mockFile = { name: "test-assignment.pdf", size: 1024 };

        const result = await submitAssignment({
            assignmentId: "assign-001",
            studentId: "student-999",
            fileObject: mockFile,
            fileName: "test-assignment.pdf",
            comments: "Completed all questions",
            classCode: "ENG-101",
            teacherId: "teacher-456",
            subjectId: "sub-123"
        });

        expect(result.success).toBe(true);
        expect(result.publicUrl).toContain("test-assignment.pdf");
        expect(supabase.storage.from).toHaveBeenCalledWith("class-materials");
        expect(supabase.from).toHaveBeenCalledWith("teacher_assessment_submissions");
    });

    it("should fetch subject details if teacherId or subjectId are omitted", async () => {
        const mockFile = { name: "test.pdf" };

        const result = await submitAssignment({
            assignmentId: "assign-001",
            studentId: "student-999",
            fileObject: mockFile,
            fileName: "test.pdf",
            classCode: "MATH-202"
        });

        expect(result.success).toBe(true);
        expect(supabase.from).toHaveBeenCalledWith("subjects");
        expect(supabase.from).toHaveBeenCalledWith("teacher_assessment_submissions");
    });
});
