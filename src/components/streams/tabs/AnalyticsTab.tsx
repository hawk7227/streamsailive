"use client";

/**
 * AnalyticsTab — Displays generation statistics from Supabase.
 */

import { useState, useEffect } from "react";
import { C } from "../tokens";
import { supabase } from "@/lib/supabaseClient";

interface Stats {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  avgGenerationTime: number;
}

export default function AnalyticsTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const { data, error } = await supabase
        .from('generation_statistics')
        .select('total_generations, successful_generations, failed_generations, avg_generation_time')
        .single();

      if (error) {
        console.error("Failed to fetch stats:", error.message);
        setStats(null);
      } else {
        setStats({
          totalGenerations: data.total_generations,
          successfulGenerations: data.successful_generations,
          failedGenerations: data.failed_generations,
          avgGenerationTime: data.avg_generation_time,
        });
      }
      setLoading(false);
    }

    fetchStats();
  }, []);

  if (loading) {
    return <div style={{ color: C.t3 }}>Loading statistics...</div>;
  }

  if (!stats) {
    return <div style={{ color: C.red }}>Failed to load statistics.</div>;
  }

  return (
    <div style={{ padding: '24px', color: C.t1 }}>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24 }}>Analytics</h2>
      <div style={{ marginTop: 16 }}>
        <div>Total Generations: {stats.totalGenerations}</div>
        <div>Successful Generations: {stats.successfulGenerations}</div>
        <div>Failed Generations: {stats.failedGenerations}</div>
        <div>Average Generation Time: {stats.avgGenerationTime} seconds</div>
      </div>
    </div>
  );
}
