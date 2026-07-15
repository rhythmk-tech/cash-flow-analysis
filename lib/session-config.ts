// Shared between auth.ts (server-side JWT/cookie expiry) and IdleLogout.tsx (client-side
// proactive sign-out), so both enforce the same "log out after this long idle" window.
export const IDLE_TIMEOUT_SECONDS = 30 * 60;
