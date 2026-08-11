import { supabase } from "@/app/lib/supabaseClient";
import { isColumnMissingError } from "@/app/lib/teacherHelpers";

/**
 * Standardize File Type Detection based on extension or mime_type/file_type
 */
export const normalizeFileType = (row = {}) => {
  const rawType = String(row.file_type || row.mime_type || "").toUpperCase().trim();
  const rawName = String(row.file_name || row.title || row.file_path || "").toUpperCase().trim();

  if (rawType.includes("PDF") || rawName.endsWith(".PDF")) return "PDF";
  if (rawType.includes("PRESENTATION") || rawType.includes("POWERPOINT") || rawType.includes("PPT") || rawName.endsWith(".PPT") || rawName.endsWith(".PPTX")) return "PPTX";
  if (rawType.includes("WORD") || rawType.includes("DOCUMENT") || rawType.includes("DOC") || rawName.endsWith(".DOC") || rawName.endsWith(".DOCX")) return "DOCX";
  if (rawType.includes("SHEET") || rawType.includes("EXCEL") || rawType.includes("XLS") || rawName.endsWith(".XLS") || rawName.endsWith(".XLSX") || rawName.endsWith(".CSV")) return "XLSX";
  if (rawType.includes("IMAGE") || rawName.endsWith(".PNG") || rawName.endsWith(".JPG") || rawName.endsWith(".JPEG") || rawName.endsWith(".WEBP") || rawName.endsWith(".GIF")) return "IMAGE";
  if (rawType.includes("VIDEO") || rawName.endsWith(".MP4") || rawName.endsWith(".MKV") || rawName.endsWith(".MOV")) return "VIDEO";
  if (rawType.includes("ZIP") || rawType.includes("RAR") || rawName.endsWith(".ZIP") || rawName.endsWith(".RAR")) return "ZIP";
  
  return rawType || "DOCUMENT";
};

/**
 * Shared Authoritative Source of Truth to fetch Class Materials from `class_materials` table.
 * Used by Class Materials Library, Class Detail, and Teacher AI Assistant.
 */
export const fetchClassMaterialsForTeacher = async ({
  teacherId,
  selectedClass = null, // { id, code, name, section, subject }
}) => {
  if (!supabase) {
    return {
      materials: [],
      totalCount: 0,
      fileTypeCounts: { PDF: 0, PPTX: 0, DOCX: 0, XLSX: 0, IMAGE: 0, VIDEO: 0, ZIP: 0, OTHER: 0 },
      lessonCounts: {},
      isError: true,
      errorMessage: "Database connection unavailable."
    };
  }

  if (!teacherId) {
    return {
      materials: [],
      totalCount: 0,
      fileTypeCounts: { PDF: 0, PPTX: 0, DOCX: 0, XLSX: 0, IMAGE: 0, VIDEO: 0, ZIP: 0, OTHER: 0 },
      lessonCounts: {},
      isError: false,
      errorMessage: ""
    };
  }

  try {
    let data = null;
    let error = null;

    // 1. Try querying teacher_id column
    const teacherIdRes = await supabase
      .from("class_materials")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });

    if (!teacherIdRes.error) {
      data = teacherIdRes.data;
    } else {
      // 2. Try querying created_by column if teacher_id fails/missing
      const createdByRes = await supabase
        .from("class_materials")
        .select("*")
        .eq("created_by", teacherId)
        .order("created_at", { ascending: false });

      if (!createdByRes.error) {
        data = createdByRes.data;
      } else {
        // 3. Fallback select all records if column filters fail
        const allRes = await supabase.from("class_materials").select("*");
        data = allRes.data;
        error = allRes.error;
      }
    }

    // Fallback if OR query or column fails
    if (error && isColumnMissingError(error)) {
      const fallbackQuery = await supabase.from("class_materials").select("*");
      const fallbackResult = await fallbackQuery;
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error && (error.code === 'PGRST116' || error.status === 400)) {
      console.warn("[classMaterialsService] class_materials table not accessible:", error);
      return {
        materials: [],
        totalCount: 0,
        fileTypeCounts: { PDF: 0, PPTX: 0, DOCX: 0, XLSX: 0, IMAGE: 0, VIDEO: 0, ZIP: 0, OTHER: 0 },
        lessonCounts: {},
        isError: true,
        errorMessage: "Unable to access class materials database table."
      };
    }

    if (error) {
      console.error("[classMaterialsService] Failed to fetch class_materials:", error);
      return {
        materials: [],
        totalCount: 0,
        fileTypeCounts: { PDF: 0, PPTX: 0, DOCX: 0, XLSX: 0, IMAGE: 0, VIDEO: 0, ZIP: 0, OTHER: 0 },
        lessonCounts: {},
        isError: true,
        errorMessage: error.message || "Failed to retrieve materials."
      };
    }

    const rawRows = data || [];

    // Filter by selectedClass if provided
    let filteredRows = rawRows;
    if (selectedClass) {
      const classIdStr = String(selectedClass.id || "").trim();
      const codeStr = String(selectedClass.code || "").trim().toLowerCase();
      const nameStr = String(selectedClass.name || "").trim().toLowerCase();
      const sectionStr = String(selectedClass.section || "").trim().toLowerCase();

      filteredRows = rawRows.filter((row) => {
        const rowSubjId = String(row.subject_id || row.class_id || "").trim();
        if (classIdStr && rowSubjId === classIdStr) return true;

        const rowSubject = String(row.subject || row.subject_name || "").trim().toLowerCase();
        const rowSection = String(row.section || "").trim().toLowerCase();

        const matchesSubject = (codeStr && rowSubject === codeStr) || (nameStr && rowSubject === nameStr);
        const matchesSection = !sectionStr || !rowSection || rowSection === sectionStr;

        if (matchesSubject && matchesSection) return true;

        return false;
      });
    }

    // Process and normalize rows
    const fileTypeCounts = { PDF: 0, PPTX: 0, DOCX: 0, XLSX: 0, IMAGE: 0, VIDEO: 0, ZIP: 0, OTHER: 0 };
    const lessonCounts = {};

    const materials = filteredRows.map((row) => {
      const normalizedType = normalizeFileType(row);
      if (fileTypeCounts[normalizedType] !== undefined) {
        fileTypeCounts[normalizedType]++;
      } else {
        fileTypeCounts.OTHER++;
      }

      const lessonKey = String(row.lesson_id || row.lesson_title || "General").trim();
      lessonCounts[lessonKey] = (lessonCounts[lessonKey] || 0) + 1;

      return {
        id: String(row.id),
        title: String(row.title || row.file_name || "Untitled Material").trim(),
        fileName: String(row.file_name || row.title || "").trim(),
        fileType: normalizedType,
        rawFileType: String(row.file_type || "").trim(),
        fileUrl: String(row.file_url || "").trim(),
        filePath: String(row.file_path || "").trim(),
        subjectId: String(row.subject_id || row.class_id || "").trim(),
        subjectName: String(row.subject || "").trim(),
        section: String(row.section || "").trim(),
        lessonId: String(row.lesson_id || "").trim(),
        lessonTitle: String(row.lesson_title || "").trim(),
        createdAt: row.created_at || null,
      };
    });

    if (import.meta.env.DEV) {
      console.log("[AI Materials Context]", {
        teacherId,
        selectedClassId: selectedClass?.id,
        selectedClass: selectedClass ? `${selectedClass.name || selectedClass.code} (${selectedClass.section})` : "All Classes",
        materialsQueryResultCount: rawRows.length,
        filteredMaterialsCount: materials.length,
        fileTypeCounts,
        materialTitles: materials.map(m => m.title),
      });
    }

    return {
      materials,
      totalCount: materials.length,
      fileTypeCounts,
      lessonCounts,
      isError: false,
      errorMessage: ""
    };
  } catch (err) {
    console.error("[classMaterialsService] Unexpected error:", err);
    return {
      materials: [],
      totalCount: 0,
      fileTypeCounts: { PDF: 0, PPTX: 0, DOCX: 0, XLSX: 0, IMAGE: 0, VIDEO: 0, ZIP: 0, OTHER: 0 },
      lessonCounts: {},
      isError: true,
      errorMessage: err.message || "An unexpected error occurred."
    };
  }
};
