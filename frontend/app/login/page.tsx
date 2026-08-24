"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiLogin } from "@/lib/api";
import { saveAuthSession, getCurrentUser, clearAuthSession } from "@/lib/auth";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const currentUser = getCurrentUser();

    const handleLogin = async (u: string, p: string) => {
        setError(null);
        setLoading(true);
        try {
            const res = await apiLogin(u, p);
            saveAuthSession(res.access_token, res.user);
            router.push("/live");
        } catch (err: any) {
            setError(err.message || "Invalid credentials.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        clearAuthSession();
        window.location.reload();
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-3xl">
                        🔒
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">System Login</h1>
                    <p className="text-xs text-slate-400">
                        Authenticate with JWT Role-Based Access (Layer 3 Security)
                    </p>
                </div>

                {currentUser ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center space-y-3">
                        <p className="text-sm text-emerald-400 font-semibold">
                            Logged in as <span className="font-bold text-white">{currentUser.username}</span> ({currentUser.role})
                        </p>
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={() => router.push("/live")}
                                className="px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl text-xs font-bold"
                            >
                                Go to Live Stream
                            </button>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-700"
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs">
                                ⚠️ {error}
                            </div>
                        )}

                        <form onSubmit={(e) => { e.preventDefault(); handleLogin(username, password); }} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-400 font-medium mb-1">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="e.g. admin"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 font-medium mb-1">Password</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                            >
                                {loading ? "Authenticating..." : "Sign In"}
                            </button>
                        </form>

                        {/* Quick 1-Click Demo Logins */}
                        <div className="border-t border-slate-800/80 pt-4 space-y-2">
                            <p className="text-[11px] text-slate-400 font-semibold text-center uppercase tracking-wider">
                                Quick Demo Logins
                            </p>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <button
                                    onClick={() => handleLogin("admin", "admin123")}
                                    className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl text-center transition-all"
                                >
                                    <div className="font-bold text-white">Admin</div>
                                    <div className="text-[10px] text-cyan-400">Full Access</div>
                                </button>
                                <button
                                    onClick={() => handleLogin("operator", "operator123")}
                                    className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl text-center transition-all"
                                >
                                    <div className="font-bold text-white">Operator</div>
                                    <div className="text-[10px] text-emerald-400">Conveyor</div>
                                </button>
                                <button
                                    onClick={() => handleLogin("viewer", "viewer123")}
                                    className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-xl text-center transition-all"
                                >
                                    <div className="font-bold text-white">Viewer</div>
                                    <div className="text-[10px] text-slate-400">Read Only</div>
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
