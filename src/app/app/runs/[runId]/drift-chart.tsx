"use client";

import { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getDriftDataAction } from "./actions";
import type { DriftPoint } from "./types";

interface DriftChartProps {
  runId: string;
}

// ---------------------------------------------------------------------------
// Colors for model lines
// ---------------------------------------------------------------------------

const LINE_COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(160, 60%, 45%)",
  "hsl(340, 65%, 50%)",
  "hsl(40, 80%, 50%)",
  "hsl(270, 55%, 55%)",
  "hsl(190, 65%, 45%)",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DriftChart({ runId }: DriftChartProps) {
  const [data, setData] = useState<DriftPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDriftDataAction(runId)
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setData(result.data);
          setError(null);
        } else {
          setError(result.error ?? "Unknown error");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch drift data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [runId]);

  // Transform data for recharts: each row = { date, model1: score, model2: score, ... }
  const { chartData, modelNames } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], modelNames: [] };

    const names = new Set<string>();
    for (const point of data) {
      for (const name of Object.keys(point.models)) {
        names.add(name);
      }
    }

    const rows = data.map((point) => {
      const row: Record<string, string | number | undefined> = {
        date: point.runDate,
      };
      for (const name of names) {
        row[name] = point.models[name];
      }
      return row;
    });

    return { chartData: rows, modelNames: [...names] };
  }, [data]);

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Loading drift data...
      </p>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-sm text-[hsl(var(--destructive))]">
        Failed to load drift data: {error}
      </p>
    );
  }

  if (!data || data.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Run this survey multiple times to see reliability trends over time.
      </p>
    );
  }

  return (
    <div className="pt-4">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="date"
            fontSize={12}
            tickFormatter={(v: string) =>
              new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            }
          />
          <YAxis domain={[0, 10]} fontSize={12} />
          <Tooltip />
          <Legend />
          {modelNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
