import ConfidenceFilter from "@/components/ConfidenceFilter";
export const metadata = { title: "Confidence Control | Box Detection" };
export default function ConfidencePage() {
    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-bold text-white">Confidence Control</h1>
                <p className="text-slate-400 text-sm mt-1">Adjust the YOLOv8 detection confidence threshold for all future detections.</p>
            </div>
            <ConfidenceFilter />
        </div>
    );
}
