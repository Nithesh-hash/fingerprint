import React, { useState, useEffect, useCallback } from 'react';
import { 
  Fingerprint, Cpu, Layers, QrCode, Search, 
  Plus, Check, Download, Zap, FileText, Code2, 
  Settings, RefreshCw, Usb, Smartphone, Camera
} from 'lucide-react';
import MetricCards from './components/MetricCards';
import TopographicViewer from './components/TopographicViewer';
import ScannerPad from './components/ScannerPad';
import HardwarePanel from './components/HardwarePanel';
import InstallModal from './components/InstallModal';
import { PATTERN_TYPES, generateFingerprintData } from './services/fingerprintGenerator';
import { exportBiometricReport } from './services/exporter';

export default function App() {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'mesh', 'scanner', 'hardware', 'history'
  const [activeTheme, setActiveTheme] = useState('ceramic');
  const [showMinutiae, setShowMinutiae] = useState(true);
  const [isHardwareConnected, setIsHardwareConnected] = useState(false);
  const [fps, setFps] = useState(60);
  const [showInstallBanner, setShowInstallBanner] = useState(true);

  // Active fingerprint frame data (width, height, Uint8Array data, minutiae points)
  const [currentFrame, setCurrentFrame] = useState(null);

  // Initialize with a high-fidelity synthetic Concentric Whorl
  useEffect(() => {
    const initialFrame = generateFingerprintData(PATTERN_TYPES.WHORL, 128, 144, 42.5);
    setCurrentFrame(initialFrame);
  }, []);

  const handleNewScan = useCallback((frame) => {
    setCurrentFrame(frame);
  }, []);

  const handleHardwareFrame = useCallback((frame) => {
    setCurrentFrame((prev) => ({
      data: frame.data,
      width: frame.width,
      height: frame.height,
      type: 'AS608 Optical Sensor Live Stream',
      minutiae: prev?.minutiae || [],
      timestamp: frame.timestamp
    }));
  }, []);

  const handleTriggerDemoScan = () => {
    const frame = generateFingerprintData(PATTERN_TYPES.WHORL, 128, 144, Math.random());
    setCurrentFrame(frame);
  };

  const handleExportJSON = () => {
    const report = {
      title: 'IsoMatrix - Biometric Topography Audit',
      timestamp: new Date().toISOString(),
      dimensions: {
        width: currentFrame?.width || 128,
        height: currentFrame?.height || 144,
      },
      minutiaeCount: currentFrame?.minutiae?.length || 25,
      minutiaeMap: currentFrame?.minutiae || []
    };
    exportBiometricReport(report);
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] lab-dot-bg text-slate-800 flex flex-col font-sans">
      {/* 1. Top PWA Install Banner */}
      {showInstallBanner && (
        <InstallModal onDismiss={() => setShowInstallBanner(false)} />
      )}

      {/* 2. Clean Top Navigation Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#090d16] flex items-center justify-center text-white shadow-xs">
              <Fingerprint size={22} />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight leading-none">
                IsoMatrix
              </h1>
              <p className="text-xs text-slate-500 font-mono tracking-tight hidden sm:block mt-0.5">
                3D Topographic Biometric Engine
              </p>
            </div>
          </div>

          {/* Action buttons on right */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                setActiveTab(activeTab === 'scanner' ? 'all' : 'scanner');
              }}
              className="px-4 py-2 rounded-full bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer uppercase"
            >
              <Camera size={14} />
              <span>Scan Real Finger</span>
            </button>

            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-pwa-install-modal'));
              }}
              className="px-4 py-2 rounded-full border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-2 transition shadow-xs cursor-pointer"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Install WebApp</span>
              <span className="sm:hidden">Install</span>
            </button>

            <button
              onClick={() => {
                setActiveTab(activeTab === 'hardware' ? 'all' : 'hardware');
              }}
              className="px-4 py-2 rounded-full border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold tracking-wide flex items-center gap-1.5 transition shadow-xs cursor-pointer uppercase"
            >
              <Usb size={14} />
              <span className="hidden sm:inline">Connect Hardware</span>
              <span className="sm:hidden">Hardware</span>
            </button>
          </div>
        </div>
      </header>

      {/* 3. Main Full-Width Dashboard Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* 4 KPI Metric Cards */}
        <MetricCards 
          currentFrame={currentFrame} 
          isHardwareConnected={isHardwareConnected} 
        />

        {/* View / Tab Selector Pills & Quick Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-full font-bold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Overview (All Modules)
            </button>

            <button
              onClick={() => setActiveTab('mesh')}
              className={`px-4 py-2 rounded-full font-semibold transition cursor-pointer ${
                activeTab === 'mesh'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              3D Topographic Mesh
            </button>

            <button
              onClick={() => setActiveTab('scanner')}
              className={`px-4 py-2 rounded-full font-semibold transition cursor-pointer ${
                activeTab === 'scanner'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Real Finger Scanner (Camera)
            </button>

            <button
              onClick={() => setActiveTab('hardware')}
              className={`px-4 py-2 rounded-full font-semibold transition cursor-pointer ${
                activeTab === 'hardware'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Hardware Serial (Live)
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-full font-semibold transition cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Biometric Audit History
            </button>
          </div>

          {/* Quick Actions Right */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMinutiae(!showMinutiae)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                showMinutiae 
                  ? 'bg-sky-50 text-sky-800 border-sky-200' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Search size={13} className="text-sky-600" />
              <span>{showMinutiae ? 'Minutiae: ON' : 'Minutiae: OFF'}</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="px-3.5 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileText size={13} className="text-emerald-600" />
              <span>Export Log</span>
            </button>
          </div>
        </div>

        {/* 3D Topographic Viewport */}
        {(activeTab === 'all' || activeTab === 'mesh') && (
          <section className="w-full">
            <TopographicViewer
              frameData={currentFrame}
              activeTheme={activeTheme}
              onThemeChange={setActiveTheme}
              showMinutiae={showMinutiae}
              onFpsUpdate={setFps}
            />
          </section>
        )}

        {/* Lower Grid: Touch Simulator & Hardware Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Touch Simulator Pad */}
          {(activeTab === 'all' || activeTab === 'scanner') && (
            <ScannerPad
              onNewScan={handleNewScan}
              currentFrame={currentFrame}
              isHardwareConnected={isHardwareConnected}
            />
          )}

          {/* Hardware Serial Panel */}
          {(activeTab === 'all' || activeTab === 'hardware') && (
            <HardwarePanel
              onHardwareFrame={handleHardwareFrame}
              isHardwareConnected={isHardwareConnected}
              setIsHardwareConnected={setIsHardwareConnected}
            />
          )}

          {/* Biometric History Log */}
          {activeTab === 'history' && (
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-900">Biometric Minutiae Audit Log</h3>
                <span className="text-xs text-slate-400 font-mono">IsoMatrix Analysis</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Index</th>
                      <th className="p-3">Minutiae Type</th>
                      <th className="p-3">X Coordinate</th>
                      <th className="p-3">Y Coordinate</th>
                      <th className="p-3">Relative Elevation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(currentFrame?.minutiae || []).slice(0, 10).map((m, i) => (
                      <tr key={i} className="hover:bg-slate-50/60">
                        <td className="p-3 text-slate-400">#{i + 1}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.type === 'bifurcation' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'
                          }`}>
                            {m.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700">{m.x} px</td>
                        <td className="p-3 text-slate-700">{m.y} px</td>
                        <td className="p-3 text-emerald-700 font-bold">{(m.elevation * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Clean Light Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-4 px-6 mt-12 font-mono text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-900" />
            <span className="font-semibold text-slate-800">IsoMatrix // Biometric Topography</span>
            <span>•</span>
            <span>Open Source Biometric Engine</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <span>WEMOS LOLIN S2 Mini + AS608 Optical Sensor</span>
            <span>•</span>
            <span>Native WebSerial API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
