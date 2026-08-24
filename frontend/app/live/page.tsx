import LiveConveyorFeed from "@/components/LiveConveyorFeed";

export const metadata = {
    title: "Live Conveyor Stream & QR Box Detection | Smart Inventory",
    description: "Real-time webcam and simulated conveyor belt box tracking and line-crossing counting."
};

export default function LivePage() {
    return (
        <div className="p-4 md:p-8">
            <LiveConveyorFeed />
        </div>
    );
}
