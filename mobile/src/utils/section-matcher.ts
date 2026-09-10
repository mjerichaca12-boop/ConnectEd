/**
 * Utility functions to normalize and match Sections and Grade Levels
 * between students and subjects in the ConnectEd mobile app.
 */

/**
 * Normalizes a section string by converting to lowercase,
 * removing whitespace, and stripping optional grade/year prefixes.
 * Examples:
 *   "Grade 7 - Diamond" -> "diamond"
 *   "7-Diamond"         -> "diamond"
 *   "Diamond"           -> "diamond"
 *   "Section A"         -> "sectiona"
 */
export function normalizeSection(value: any): string {
    if (value === null || value === undefined) return "";
    const str = String(value).trim().toLowerCase();
    if (!str) return "";

    // Strip common grade prefixes like "grade 7 - ", "year 8 : ", "7-", "g10 "
    const strippedPrefix = str
        .replace(/^(?:grade|year|level|g)?\s*\d{1,2}\s*[-–_:.]?\s*/i, '')
        .trim();

    const target = strippedPrefix || str;
    return target.replace(/\s+/g, '');
}

/**
 * Checks if a section value represents an unassigned or universal section.
 */
export function isUniversalOrUnassignedSection(value: any): boolean {
    if (!value) return true;
    const norm = String(value).trim().toLowerCase();
    return (
        norm === "" ||
        norm === "all" ||
        norm === "all sections" ||
        norm === "general" ||
        norm === "unassigned" ||
        norm === "none" ||
        norm === "n/a" ||
        norm === "null" ||
        norm === "undefined"
    );
}

/**
 * Checks if a student's section matches a subject's section.
 *
 * Rules:
 * 1. If the subject has no specific section (universal/general/all/unassigned), all students can see it.
 * 2. If the subject has a specific section assigned:
 *    - If the student has no section assigned, they cannot see section-specific subjects.
 *    - If the student has a section, both normalized sections must match.
 */
export function isSectionMatch(studentSection: any, subjectSection: any): boolean {
    // If subject has no specific section restriction, it's open to all sections
    if (isUniversalOrUnassignedSection(subjectSection)) {
        return true;
    }

    // If subject requires a specific section, student must have a valid matching section
    if (isUniversalOrUnassignedSection(studentSection)) {
        return false;
    }

    const normStudent = normalizeSection(studentSection);
    const normSubject = normalizeSection(subjectSection);

    if (normStudent === normSubject) {
        return true;
    }

    // Direct comparison without prefix stripping (e.g. raw lowercase without spaces)
    const rawStudent = String(studentSection).trim().toLowerCase().replace(/\s+/g, '');
    const rawSubject = String(subjectSection).trim().toLowerCase().replace(/\s+/g, '');

    if (rawStudent === rawSubject) {
        return true;
    }

    // Token containment check (e.g. "Diamond" inside "7-Diamond")
    if (normStudent.length >= 3 && normSubject.includes(normStudent)) {
        return true;
    }
    if (normSubject.length >= 3 && normStudent.includes(normSubject)) {
        return true;
    }

    return false;
}

/**
 * Normalizes a grade level string to its numeric string or clean keyword.
 * Examples:
 *   "Grade 7" -> "7"
 *   "Year 10" -> "10"
 *   "7"       -> "7"
 *   "Kinder"  -> "kinder"
 */
export function normalizeGradeLevel(value: any): string {
    if (value === null || value === undefined) return "";
    const str = String(value).trim();
    if (!str) return "";

    const digits = str.match(/\d+/);
    if (digits) {
        return String(digits[0]);
    }

    return str.toLowerCase().replace(/grade|year|level|\s+/g, '').trim();
}

/**
 * Checks if a student's grade level matches a subject's grade level.
 * If either is unspecified, it is treated as non-restricting.
 */
export function isGradeLevelMatch(studentGrade: any, subjectGrade: any): boolean {
    const normStudent = normalizeGradeLevel(studentGrade);
    const normSubject = normalizeGradeLevel(subjectGrade);

    if (!normStudent || !normSubject) {
        return true;
    }

    return normStudent === normSubject;
}
