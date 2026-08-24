"use client";

import { useEffect, useState } from "react";
import {
    fetchProducts,
    createProduct,
    deleteProduct,
    fetchBoxCrossingRecords,
    fetchSystemInfo,
    ProductItem,
    BoxCrossingRecord
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export default function AdminPage() {
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [crossingLogs, setCrossingLogs] = useState<BoxCrossingRecord[]>([]);
    const [systemInfo, setSystemInfo] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<"catalog" | "crossings" | "system">("catalog");

    // New product form
    const [qrCode, setQrCode] = useState("");
    const [name, setName] = useState("");
    const [category, setCategory] = useState("Electronics");
    const [sku, setSku] = useState("");
    const [weightKg, setWeightKg] = useState<string>("1.5");
    const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

    const currentUser = getCurrentUser();

    const loadData = async () => {
        setLoading(true);
        try {
            const [prods, logs, info] = await Promise.all([
                fetchProducts(),
                fetchBoxCrossingRecords(100),
                fetchSystemInfo()
            ]);
            setProducts(prods);
            setCrossingLogs(logs);
            setSystemInfo(info);
        } catch (e) {
            console.error("Failed to load admin data", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!qrCode || !name) {
            setStatusMsg({ text: "QR Code and Product Name are required.", isError: true });
            return;
        }

        try {
            await createProduct({
                qr_code: qrCode.trim(),
                name: name.trim(),
                category,
                sku: sku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
                weight_kg: parseFloat(weightKg) || 1.0,
            });
            setStatusMsg({ text: `Product "${name}" saved to MongoDB catalog!` });
            setQrCode("");
            setName("");
            setSku("");
            loadData();
        } catch (err: any) {
            setStatusMsg({ text: err.message || "Failed to create product.", isError: true });
        }
    };

    const handleDeleteProduct = async (code: string) => {
        if (!confirm(`Delete product ${code}?`)) return;
        try {
            await deleteProduct(code);
            loadData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleExportJson = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            system: systemInfo,
            products: products,
            box_crossings: crossingLogs
        }, null, 2));
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `mongodb_export_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl backdrop-blur-md">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        <span>🛡️</span> Admin Panel & MongoDB Datastore
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Manage QR codes, product mappings, MongoDB collections, and line-crossing audit records.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportJson}
                        className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold rounded-xl transition-all"
                    >
                        📥 Export JSON Data
                    </button>
                    <button
                        onClick={loadData}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
                    >
                        🔄 Refresh Data
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-xs text-slate-400 font-medium">MongoDB Status</div>
                    <div className="text-sm font-bold mt-1 flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${systemInfo?.mongodb_connected ? "bg-emerald-400" : "bg-cyan-400"}`}></span>
                        <span className={systemInfo?.mongodb_connected ? "text-emerald-400" : "text-cyan-400"}>
                            {systemInfo?.mongodb_connected ? "Live MongoDB" : "Active (Embedded)"}
                        </span>
                    </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-xs text-slate-400 font-medium">Total Box Crossings</div>
                    <div className="text-xl font-bold text-white mt-1">
                        {crossingLogs.length} <span className="text-xs text-slate-500 font-normal">records</span>
                    </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-xs text-slate-400 font-medium">QR Catalog Items</div>
                    <div className="text-xl font-bold text-white mt-1">
                        {products.length} <span className="text-xs text-slate-500 font-normal">products</span>
                    </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                    <div className="text-xs text-slate-400 font-medium">Active Database</div>
                    <div className="text-sm font-mono text-cyan-400 mt-1 truncate">
                        {systemInfo?.mongodb_database || "smart_inventory"}
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                    onClick={() => setActiveTab("catalog")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === "catalog"
                            ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                            : "text-slate-400 hover:text-white"
                    }`}
                >
                    🏷️ QR Product Catalog ({products.length})
                </button>
                <button
                    onClick={() => setActiveTab("crossings")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === "crossings"
                            ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                            : "text-slate-400 hover:text-white"
                    }`}
                >
                    📜 Box Crossing Audit Log ({crossingLogs.length})
                </button>
                <button
                    onClick={() => setActiveTab("system")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === "system"
                            ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20"
                            : "text-slate-400 hover:text-white"
                    }`}
                >
                    ⚙️ MongoDB Setup & Compass Guide
                </button>
            </div>

            {/* TAB 1: PRODUCT CATALOG */}
            {activeTab === "catalog" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Product Form */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                            <span>➕</span> Add QR Product Mapping
                        </h2>

                        {statusMsg && (
                            <div className={`p-3 rounded-xl text-xs ${statusMsg.isError ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"}`}>
                                {statusMsg.text}
                            </div>
                        )}

                        <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
                            <div>
                                <label className="block text-slate-400 font-medium mb-1">QR Code String / Payload</label>
                                <input
                                    type="text"
                                    placeholder="e.g. BOX-ELEC-009"
                                    value={qrCode}
                                    onChange={(e) => setQrCode(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 font-medium mb-1">Product Title</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Lithium Battery Pack"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                                    >
                                        <option value="Electronics">Electronics</option>
                                        <option value="Automotive">Automotive</option>
                                        <option value="Food & Beverage">Food & Beverage</option>
                                        <option value="Pharmaceuticals">Pharmaceuticals</option>
                                        <option value="General Goods">General Goods</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">SKU Number</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. SKU-5501"
                                        value={sku}
                                        onChange={(e) => setSku(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 font-medium mb-1">Unit Weight (kg)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={weightKg}
                                    onChange={(e) => setWeightKg(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-lg shadow-cyan-500/20 mt-2"
                            >
                                💾 Save Product to DB
                            </button>
                        </form>
                    </div>

                    {/* Products Table */}
                    <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                            📦 Active QR Catalog ({products.length})
                        </h2>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400">
                                        <th className="pb-3 font-semibold">QR Code</th>
                                        <th className="pb-3 font-semibold">Product Name</th>
                                        <th className="pb-3 font-semibold">Category</th>
                                        <th className="pb-3 font-semibold">SKU</th>
                                        <th className="pb-3 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {products.map((p) => (
                                        <tr key={p.qr_code} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="py-3 font-mono text-cyan-400 font-medium">{p.qr_code}</td>
                                            <td className="py-3 font-semibold text-white">{p.name}</td>
                                            <td className="py-3 text-slate-400">{p.category}</td>
                                            <td className="py-3 font-mono text-slate-400">{p.sku}</td>
                                            <td className="py-3 text-right">
                                                <button
                                                    onClick={() => handleDeleteProduct(p.qr_code)}
                                                    className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: CROSSING AUDIT LOGS */}
            {activeTab === "crossings" && (
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                            📋 Individual Box Crossing Records (Database Layer 4)
                        </h2>
                        <span className="text-xs text-slate-400">Stored in MongoDB `boxes` collection</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-slate-800 text-slate-400">
                                    <th className="pb-3 font-semibold">Box ID</th>
                                    <th className="pb-3 font-semibold">QR Code</th>
                                    <th className="pb-3 font-semibold">Product Name</th>
                                    <th className="pb-3 font-semibold">Category</th>
                                    <th className="pb-3 font-semibold">Confidence</th>
                                    <th className="pb-3 font-semibold text-right">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {crossingLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center text-slate-500">
                                            No crossing events recorded yet. Start the conveyor in the Live Feed tab!
                                        </td>
                                    </tr>
                                ) : (
                                    crossingLogs.map((log, idx) => (
                                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="py-3 font-bold text-white flex items-center gap-1.5">
                                                <span className="text-emerald-400">✓</span> {log.box_id}
                                            </td>
                                            <td className="py-3 font-mono text-cyan-400">{log.qr_code}</td>
                                            <td className="py-3 font-semibold text-slate-200">{log.product_name || "General Box"}</td>
                                            <td className="py-3 text-slate-400">{log.category || "General"}</td>
                                            <td className="py-3 text-emerald-400 font-mono">{Math.round((log.confidence || 0.85) * 100)}%</td>
                                            <td className="py-3 font-mono text-slate-400 text-right">{log.timestamp}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: MONGODB GUIDE */}
            {activeTab === "system" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                            🍃 MongoDB Connection Details
                        </h2>
                        <div className="space-y-3 text-xs">
                            <div className="flex justify-between items-center py-2 border-b border-slate-800">
                                <span className="text-slate-400">MongoDB Status:</span>
                                <span className={`font-semibold px-2.5 py-0.5 rounded-full ${systemInfo?.mongodb_connected ? "bg-emerald-500/10 text-emerald-400" : "bg-cyan-500/10 text-cyan-400"}`}>
                                    {systemInfo?.mongodb_connected ? "Connected (Live Server)" : "Active (Embedded Document Store)"}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-800">
                                <span className="text-slate-400">Connection URI:</span>
                                <span className="font-mono text-cyan-400">{systemInfo?.mongodb_uri || "mongodb://localhost:27017"}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-800">
                                <span className="text-slate-400">Database Name:</span>
                                <span className="font-mono text-white">{systemInfo?.mongodb_database || "smart_inventory"}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-800">
                                <span className="text-slate-400">Total Box Records:</span>
                                <span className="font-mono text-white">{crossingLogs.length}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                            🧭 Step-by-Step MongoDB Guide
                        </h2>
                        <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                            <p className="font-bold text-cyan-400">Option A: Local MongoDB (Free)</p>
                            <ol className="list-decimal list-inside space-y-1 text-slate-400">
                                <li>Install MongoDB Community Server or run: <code className="text-white bg-slate-950 px-1 py-0.5 rounded">winget install MongoDB.Server</code></li>
                                <li>Start service: <code className="text-white bg-slate-950 px-1 py-0.5 rounded">net start MongoDB</code></li>
                                <li>Open <strong>MongoDB Compass</strong> and connect to <code className="text-cyan-400">mongodb://localhost:27017</code></li>
                                <li>Select database <code className="text-emerald-400">smart_inventory</code> to view <code className="text-white">boxes</code>, <code className="text-white">products</code>, <code className="text-white">sessions</code>!</li>
                            </ol>

                            <p className="font-bold text-cyan-400 pt-2">Option B: Cloud MongoDB Atlas</p>
                            <p className="text-slate-400">
                                Put your free MongoDB Atlas URI into <code className="text-white bg-slate-950 px-1 py-0.5 rounded">backend/.env</code>:
                                <br />
                                <code className="text-cyan-300 block bg-slate-950 p-1.5 rounded mt-1 overflow-x-auto">MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/smart_inventory"</code>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
