import SessionReplay from "@/components/SessionReplay";
export const metadata = { title: "Session Replay | Box Detection" };
export default function ReplayPage() {
    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-bold text-white">Session Replay</h1>
                <p className="text-slate-400 text-sm mt-1">Browse and replay previous detection sessions with full statistics.</p>
            </div>
            <SessionReplay />
        </div>
    );
}
