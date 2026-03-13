import DetectionReport from "@/components/DetectionReport";
export const metadata = { title: "Detection Reports | Box Detection" };
export default function ReportsPage() {
    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-bold text-white">Detection Reports</h1>
                <p className="text-slate-400 text-sm mt-1">Generate and download PDF reports for any detection session.</p>
            </div>
            <DetectionReport />
        </div>
    );
}
