"use client";

import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

interface Props {
    data: { metric: string; A: number; B: number }[];
}

export default function ComparisonChart({ data }: Props) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="metric" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px" }} />
                <Legend />
                <Bar dataKey="A" fill="#3b82f6" name="Session A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="B" fill="#ec4899" name="Session B" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}
