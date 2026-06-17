/**
 * Password validation utility for ConnectEd student registration.
 * Enforces strong-password rules required for new accounts.
 */

export interface PasswordValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validates a password against ConnectEd's strength requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter (A–Z)
 * - At least one digit (0–9)
 * - At least one special character (!@#$%^&*...)
 *
 * @param password - The raw password string to validate.
 * @returns `{ valid, errors }` — `valid` is true only when `errors` is empty.
 */
export function validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];

    if (!password || password.length < 12) {
        errors.push('Password must be at least 12 characters long.');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter.');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number.');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push('Password must contain at least one special character (e.g. !@#$%^&*).');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Returns a human-readable strength label based on how many rules pass.
 * Useful for displaying a live strength bar in the UI.
 *
 * @param password - The raw password string to evaluate.
 * @returns 'weak' | 'fair' | 'strong'
 */
export function passwordStrengthLabel(password: string): 'weak' | 'fair' | 'strong' {
    const { errors } = validatePassword(password);
    const passed = 4 - errors.length;
    if (passed <= 1) return 'weak';
    if (passed <= 3) return 'fair';
    return 'strong';
}
