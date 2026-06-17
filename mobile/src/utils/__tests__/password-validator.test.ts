import { describe, it, expect } from 'vitest';
import { validatePassword, passwordStrengthLabel } from '../password-validator';

describe('validatePassword', () => {
    it('rejects a password shorter than 12 characters', () => {
        const result = validatePassword('Short1!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must be at least 12 characters long.');
    });

    it('rejects a password with no uppercase letter', () => {
        const result = validatePassword('alllower1234!@');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one uppercase letter.');
    });

    it('rejects a password with no digit', () => {
        const result = validatePassword('NoDigitsHere!!!');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password must contain at least one number.');
    });

    it('rejects a password with no special character', () => {
        const result = validatePassword('NoSpecialChar123');
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
            'Password must contain at least one special character (e.g. !@#$%^&*).'
        );
    });

    it('rejects an empty string', () => {
        const result = validatePassword('');
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('accepts a fully valid password', () => {
        const result = validatePassword('Secure@Pass123!');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('returns multiple errors for a weak password', () => {
        const result = validatePassword('abc');
        expect(result.valid).toBe(false);
        // Should fail: length, uppercase, digit, special char
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
});

describe('passwordStrengthLabel', () => {
    it('returns "weak" for a very short password', () => {
        expect(passwordStrengthLabel('abc')).toBe('weak');
    });

    it('returns "fair" for a partially valid password', () => {
        // Has uppercase + length but missing digit and special
        expect(passwordStrengthLabel('LongEnoughButNoDigit!')).toBe('fair');
    });

    it('returns "strong" for a fully valid password', () => {
        expect(passwordStrengthLabel('Secure@Pass123!')).toBe('strong');
    });
});
