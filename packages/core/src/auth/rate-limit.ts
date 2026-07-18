export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export function nextLockout(failedAttempts: number, now = new Date()): Date | null {
  if (failedAttempts < MAX_FAILED_ATTEMPTS) return null;
  return new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
}

export function isLocked(lockedUntil: Date | null, now = new Date()): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}
