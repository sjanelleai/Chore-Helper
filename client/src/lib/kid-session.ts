export interface KidSession {
  familyId: string;
  familyNumber: string;
  kidToken: string;
  childId?: string;
  childName?: string;
  expiresAt: number;
}

const KID_SESSION_KEY = "kidSession";

export function loadKidSession(): KidSession | null {
  try {
    const raw = sessionStorage.getItem(KID_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as KidSession;
    if (!s.expiresAt || Date.now() > s.expiresAt) {
      sessionStorage.removeItem(KID_SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    sessionStorage.removeItem(KID_SESSION_KEY);
    return null;
  }
}

export function saveKidSession(s: KidSession) {
  sessionStorage.setItem(KID_SESSION_KEY, JSON.stringify(s));
}

export function clearKidSession() {
  sessionStorage.removeItem(KID_SESSION_KEY);
}

export function updateKidSessionChild(childId: string, childName: string) {
  const s = loadKidSession();
  if (!s) return;
  s.childId = childId;
  s.childName = childName;
  saveKidSession(s);
}

export type AppMode = "parent" | "kid" | "guest";
