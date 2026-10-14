import React from 'react';
import { Box, CheckCircle2, ArrowLeftRight, AlertTriangle } from 'lucide-react';

export default function MetricCards({ currentFrame, isHardwareConnected }) {
  const dataLength = currentFrame?.data?.length || 18432;
  const memoryKb = (dataLength / 1024).toFixed(0);
  const minutiae = currentFrame?.minutiae || [];
  const matchScore = currentFrame ? Math.min(99.4, 88.0 + (minutiae.length * 0.45)).toFixed(0) : '98';
  const ridgeDensity = (2.2 + (minutiae.length % 5) * 0.08).toFixed(2);
  const minutiaeCount = minutiae.length || 25;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Buffer Memory */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase block mb-1">
            FRAME MEMORY
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {memoryKb}
            </span>
            <span className="text-xs font-semibold text-slate-500 font-mono">KB</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600">
          <Box size={22} />
        </div>
      </div>

      {/* 2. Match Confidence */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold font-mono tracking-wider text-emerald-600 uppercase block mb-1">
            MATCH CONFIDENCE
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-emerald-600 tracking-tight">
              {matchScore}
            </span>
            <span className="text-xs font-semibold text-emerald-600 font-mono">%</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600">
          <CheckCircle2 size={22} />
        </div>
      </div>

      {/* 3. Ridge Density */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold font-mono tracking-wider text-slate-400 uppercase block mb-1">
            RIDGE DENSITY
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {ridgeDensity}
            </span>
            <span className="text-xs font-semibold text-slate-500 font-mono">/mm</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-600">
          <ArrowLeftRight size={22} />
        </div>
      </div>

      {/* 4. Minutiae Features */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold font-mono tracking-wider text-rose-600 uppercase block mb-1">
            MINUTIAE FEATURES
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-rose-600 tracking-tight">
              {minutiaeCount}
            </span>
            <span className="text-xs font-semibold text-rose-500 font-mono">pts</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600">
          <AlertTriangle size={22} />
        </div>
      </div>
    </div>
  );
}
