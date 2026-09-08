export interface FormattableProfile {
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    suffix?: string | null;
    name_extension?: string | null;
    extension?: string | null;
    full_name?: string | null;
    displayName?: string | null;
    name?: string | null;
    role?: string | null;
}

/**
 * Normalizes a suffix string by removing leading/trailing punctuation and whitespace for comparison.
 */
function normalizeSuffix(str: string): string {
    return str.toLowerCase().replace(/^[,\s.]+|[,\s.]+$/g, '').trim();
}

/**
 * Formats a teacher's or instructor's name with their name extension / suffix (e.g. Jr., Sr., II, III).
 * 
 * Examples:
 * - { first_name: "Rosh", last_name: "Ogad", suffix: "Jr." } -> "Rosh Ogad Jr."
 * - { first_name: "Rosh", last_name: "Ogad Jr." } -> "Rosh Ogad Jr."
 * - { first_name: "Rosh", last_name: "Ogad Jr.", suffix: "Jr." } -> "Rosh Ogad Jr." (no duplication)
 * - { first_name: "Juan", last_name: "dela Cruz", suffix: "III" } -> "Juan dela Cruz III"
 */
export function formatTeacherName(profile?: FormattableProfile | string | null): string {
    if (!profile) return "";

    if (typeof profile === "string") {
        return profile.trim();
    }

    const first = (profile.first_name || "").trim();
    const last = (profile.last_name || "").trim();
    const suffix = (profile.suffix || profile.name_extension || profile.extension || "").trim();

    let base = [first, last].filter(Boolean).join(" ").trim();
    if (!base) {
        const fallback = (profile.full_name || profile.displayName || profile.name || "").trim();
        if (!fallback) return "";
        base = fallback;
    }

    if (suffix) {
        const normSuffix = normalizeSuffix(suffix);
        const normBase = normalizeSuffix(base);
        // Avoid duplicate suffix if the base name already ends with the suffix
        if (normSuffix && !normBase.endsWith(normSuffix)) {
            return `${base} ${suffix}`.trim();
        }
    }

    return base;
}

/**
 * Formats a user's full name, including middle name (if present) and name extension / suffix.
 * 
 * Examples:
 * - { first_name: "Juan", middle_name: "Mendoza", last_name: "dela Cruz", suffix: "Jr." }
 *   -> "Juan Mendoza dela Cruz Jr."
 */
export function formatFullName(profile?: FormattableProfile | string | null): string {
    if (!profile) return "";

    if (typeof profile === "string") {
        return profile.trim();
    }

    const first = (profile.first_name || "").trim();
    const middle = (profile.middle_name || "").trim();
    const last = (profile.last_name || "").trim();
    const suffix = (profile.suffix || profile.name_extension || profile.extension || "").trim();

    let nameParts = [first, middle, last].filter(Boolean).join(" ").trim();
    if (!nameParts) {
        const fallback = (profile.full_name || profile.displayName || profile.name || "").trim();
        if (!fallback) return "";
        nameParts = fallback;
    }

    if (suffix) {
        const normSuffix = normalizeSuffix(suffix);
        const normParts = normalizeSuffix(nameParts);
        if (normSuffix && !normParts.endsWith(normSuffix)) {
            return `${nameParts} ${suffix}`.trim();
        }
    }

    return nameParts;
}
