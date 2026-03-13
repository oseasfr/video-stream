const DEFAULT_VERIFY_PASSWORD_URL = "/api/verify-password";
const DEFAULT_UPLOAD_URL = "/api/upload";

export const VERIFY_PASSWORD_URL = (import.meta.env.VITE_VERIFY_PASSWORD_URL || DEFAULT_VERIFY_PASSWORD_URL).trim();
export const UPLOAD_URL = (import.meta.env.VITE_UPLOAD_URL || DEFAULT_UPLOAD_URL).trim();
