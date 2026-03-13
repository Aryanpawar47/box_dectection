import InventoryAlert from "@/components/InventoryAlert";

export const metadata = {
    title: "Inventory Mismatch Alert | Box Detection",
};

export default function InventoryMismatchPage() {
    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Inventory Mismatch Alert</h1>
                <p className="text-slate-400 text-sm mt-1">
                    Compare expected inventory counts against live YOLO object detection data.
                </p>
            </div>

            <InventoryAlert />

        </div>
    );
}
