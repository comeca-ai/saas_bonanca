type LoginWindow = { attempts: number; resetAt: number };

const loginWindows = new Map<string, LoginWindow>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function prune(now: number) {
  for (const [key, value] of loginWindows) {
    if (value.resetAt <= now) loginWindows.delete(key);
  }
}

export function loginRateKey(ip: string | undefined, email: string) {
  return `${ip?.trim() || "unknown"}:${email.trim().toLowerCase()}`;
}

export function isLoginRateLimited(key: string, now = Date.now()) {
  prune(now);
  const current = loginWindows.get(key);
  return Boolean(current && current.attempts >= MAX_ATTEMPTS && current.resetAt > now);
}

export function registerFailedLogin(key: string, now = Date.now()) {
  prune(now);
  const current = loginWindows.get(key);
  if (!current || current.resetAt <= now) {
    loginWindows.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.attempts += 1;
}

export function clearFailedLogins(key: string) {
  loginWindows.delete(key);
}
