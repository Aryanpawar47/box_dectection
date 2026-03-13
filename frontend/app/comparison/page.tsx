import SessionComparison from "@/components/SessionComparison";
export const metadata = { title: "Session Comparison | Box Detection" };
export default function ComparisonPage() {
    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-bold text-white">Session Comparison Analytics</h1>
                <p className="text-slate-400 text-sm mt-1">Compare metrics between two detection sessions side-by-side.</p>
            </div>
            <SessionComparison />
        </div>
    );
}
