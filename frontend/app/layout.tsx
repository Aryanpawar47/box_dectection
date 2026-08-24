import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import MobileNav from "@/components/MobileNav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI-powered industrial monitoring platform",
  description:
    "Real-time AI-powered box detection and counting using YOLOv8 for industrial automation.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📦</text></svg>",
  },
};

const navLinks = [
  { href: "/live", label: "Live Conveyor", icon: "🔴", badge: "LIVE" },
  { href: "/dashboard", label: "Dashboard", icon: "🖥️" },
  { href: "/admin", label: "Admin & Catalog", icon: "🛡️" },
  { href: "/upload", label: "Upload & Detect", icon: "📤" },
  { href: "/inventory-mismatch", label: "Inventory Alert", icon: "⚠️" },
  { href: "/confidence", label: "Confidence Control", icon: "🎯" },
  { href: "/replay", label: "Session Replay", icon: "▶️" },
  { href: "/reports", label: "Detection Reports", icon: "📊" },
  { href: "/comparison", label: "Session Comparison", icon: "📈" },
  { href: "/anomaly", label: "Anomaly Alerts", icon: "🧠" },
  { href: "/login", label: "Auth / Login", icon: "🔑" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen flex`}>
        {/* Sidebar */}
        <aside className="sticky top-0 h-screen overflow-y-auto hidden md:flex flex-col w-60 shrink-0 border-r border-slate-800 bg-slate-900/70 backdrop-blur-md">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
            <span className="text-2xl">📦</span>
            <div>
              <p className="font-bold text-white text-sm leading-tight">AI-powered industrial monitoring platform</p>
              <p className="text-slate-500 text-xs"></p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navLinks.map(({ href, label, icon, badge }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-base group-hover:scale-110 transition-transform">{icon}</span>
                  <span>{label}</span>
                </div>
                {badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-red-500 text-white rounded-md animate-pulse">
                    {badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-800">
            <p className="text-slate-600 text-xs"></p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 relative pb-20 md:pb-0">{children}</main>

        {/* Mobile Navigation */}
        <MobileNav />
      </body>
    </html>
  );
}
