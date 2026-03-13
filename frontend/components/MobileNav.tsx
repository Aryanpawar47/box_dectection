"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MobileNav() {
    const pathname = usePathname();

    const navLinks = [
        { href: "/dashboard", label: "Home", icon: "🖥️" },
        { href: "/upload", label: "Detect", icon: "📤" },
        { href: "/inventory-mismatch", label: "Inventory", icon: "⚠️" },
        { href: "/confidence", label: "Conf", icon: "🎯" },
        { href: "/replay", label: "Replay", icon: "▶️" },
        { href: "/reports", label: "Reports", icon: "📊" },
        { href: "/comparison", label: "Compare", icon: "📈" },
        { href: "/anomaly", label: "Anomaly", icon: "🧠" },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 pb-[env(safe-area-inset-bottom)]">
            <nav className="flex items-center justify-around px-2 py-1.5">
                {navLinks.map(({ href, label, icon }) => {
                    // Default to dashboard if we're at root
                    const isActive = pathname === href || (pathname === "/" && href === "/dashboard");
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`flex flex-col items-center justify-center w-20 h-14 rounded-2xl transition-all duration-200 ${isActive
                                ? "text-green-400 bg-slate-800/50"
                                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
                                }`}
                        >
                            <span className={`text-xl mb-0.5 ${isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]" : "scale-100"} transition-all duration-300`}>
                                {icon}
                            </span>
                            <span className={`text-[10px] font-semibold tracking-wide ${isActive ? "opacity-100" : "opacity-80"}`}>
                                {label}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
