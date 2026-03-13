"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
    value: number;
    // For formatting numbers with decimals
    isFloat?: boolean;
}

export default function AnimatedNumber({ value, isFloat = false }: Props) {
    const [displayValue, setDisplayValue] = useState(0);
    const animRef = useRef<number | null>(null);

    useEffect(() => {
        if (animRef.current) cancelAnimationFrame(animRef.current);

        const start = 0; // Always drop to 0 on mount/change for effect
        const end = value;
        const duration = 600;
        const startTime = performance.now();

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // Ease-out cubic

            const current = start + (end - start) * eased;
            setDisplayValue(isFloat ? current : Math.round(current));

            if (progress < 1) animRef.current = requestAnimationFrame(animate);
        };

        animRef.current = requestAnimationFrame(animate);
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }, [value, isFloat]);

    return <>{isFloat ? displayValue.toFixed(2) : displayValue.toLocaleString()}</>;
}
