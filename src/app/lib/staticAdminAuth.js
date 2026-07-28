const DEFAULT_ADMIN_EMAIL = "admin.connected.local";
const DEFAULT_ADMIN_PASSWORD = "@dminConnected";
//password hash (SHA-256 of above, only used in secure contexts):
const DEFAULT_ADMIN_PASSWORD_HASH = "2a02c4fc048fdb63e7369950b4b6f0fbab8bc783581b58b1c4d160c645addc8f";

export const STATIC_ADMIN_EMAIL = String(import.meta.env.VITE_STATIC_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
  .trim()
  .toLowerCase();

const STATIC_ADMIN_PASSWORD_HASH = String(import.meta.env.VITE_STATIC_ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH)
  .trim()
  .toLowerCase();

// Plaintext fallback used when crypto.subtle is unavailable (HTTP on LAN IP)
const STATIC_ADMIN_PASSWORD = String(import.meta.env.VITE_STATIC_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD);

const encoder = new TextEncoder();

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

export const isStaticAdminUser = (user) => {
  if (!user || user.role !== "admin") return false;
  return normalizeEmail(user.email) === STATIC_ADMIN_EMAIL;
};

export const getStaticAdminSessionUser = (token) => ({
  id: "11111111-1111-1111-1111-111111111111",
  name: "System Administrator",
  email: STATIC_ADMIN_EMAIL,
  role: "admin",
  school_id: null,
  token: token
});

export const validateStaticAdminCredentials = async (email, password) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || "");

  if (normalizedEmail !== STATIC_ADMIN_EMAIL) {
    return { ok: false, message: "Admin account email is incorrect." };
  }

  if (!normalizedPassword) {
    return { ok: false, message: "Password is required." };
  }

  // crypto.subtle only works in secure contexts (HTTPS or localhost).
  // On plain HTTP (LAN IP), fall back to plaintext comparison.
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const digest = await crypto.subtle.digest("SHA-256", encoder.encode(normalizedPassword));
      const passwordHash = toHex(digest);
      if (passwordHash !== STATIC_ADMIN_PASSWORD_HASH) {
        return { ok: false, message: "Admin password is incorrect." };
      }
      return { ok: true, token: passwordHash };
    } catch {
      // Fall through to plaintext check below
    }
  }

  // Plaintext fallback for non-secure contexts
  if (normalizedPassword !== STATIC_ADMIN_PASSWORD) {
    return { ok: false, message: "Admin password is incorrect." };
  }

  return { ok: true, token: "plaintext_fallback" };
};
