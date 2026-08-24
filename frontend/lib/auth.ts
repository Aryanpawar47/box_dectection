// Authentication & User Session Store
export interface UserProfile {
    username: string;
    role: "admin" | "operator" | "viewer";
    full_name: string;
}

const TOKEN_KEY = "smart_inv_auth_token";
const USER_KEY = "smart_inv_user_profile";

export function getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): UserProfile | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function saveAuthSession(token: string, user: UserProfile) {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}
