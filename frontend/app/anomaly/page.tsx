import AnomalyAlertComponent from "@/components/AnomalyAlert";
export const metadata = { title: "Anomaly Alerts | Box Detection" };
export default function AnomalyPage() {
    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div>
                <h1 className="text-2xl font-bold text-white">AI Anomaly Alerts</h1>
                <p className="text-slate-400 text-sm mt-1">Automatically detect unusual patterns in detection data using a moving average model.</p>
            </div>
            <AnomalyAlertComponent />
        </div>
    );
}
