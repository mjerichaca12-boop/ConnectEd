const DEFAULT_ADMIN_EMAIL = "admin.connected.local";
//password: @dminConnected
const DEFAULT_ADMIN_PASSWORD_HASH = "2a02c4fc048fdb63e7369950b4b6f0fbab8bc783581b58b1c4d160c645addc8f";

export const STATIC_ADMIN_EMAIL = String(import.meta.env.VITE_STATIC_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL)
  .trim()
  .toLowerCase();

const STATIC_ADMIN_PASSWORD_HASH = String(import.meta.env.VITE_STATIC_ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_PASSWORD_HASH)
  .trim()
  .toLowerCase();

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

export const getStaticAdminSessionUser = () => ({
  name: "System Administrator",
  email: STATIC_ADMIN_EMAIL,
  role: "admin"
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

  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(normalizedPassword));
  const passwordHash = toHex(digest);

  if (passwordHash !== STATIC_ADMIN_PASSWORD_HASH) {
    return { ok: false, message: "Admin password is incorrect." };
  }

  return { ok: true };
};
