import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Fingerprint, Camera, Sparkles, Upload, RefreshCw, 
  CheckCircle2, Radio, Zap, ShieldAlert, Cpu, 
  Flashlight, FlashlightOff, SwitchCamera, StopCircle, Sliders
} from 'lucide-react';
import { 
  PATTERN_TYPES, 
  generateFingerprintData, 
  processUploadedImage, 
  processCameraVideoFrame 
} from '../services/fingerprintGenerator';

export default function ScannerPad({
  onNewScan,
  currentFrame,
  isHardwareConnected = false
}) {
  // Mode: 'camera' (real finger) or 'simulator' (fallback demo)
  const [scanMode, setScanMode] = useState('camera');
  
  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment'); // 'environment' or 'user'
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [contrastBoost, setContrastBoost] = useState(2.4);
  const [isCapturing, setIsCapturing] = useState(false);

  // Simulator Fallback State
  const [selectedPattern, setSelectedPattern] = useState(PATTERN_TYPES.WHORL);
  const [isScanningSim, setIsScanningSim] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvas2dRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Render 2D raw sensor stream on the canvas
  useEffect(() => {
    if (!currentFrame || !canvas2dRef.current) return;
    const canvas = canvas2dRef.current;
    const ctx = canvas.getContext('2d');
    const { data, width, height, minutiae } = currentFrame;

    canvas.width = width;
    canvas.height = height;

    const imgData = ctx.createImageData(width, height);
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      imgData.data[i * 4] = v;     // R
      imgData.data[i * 4 + 1] = v; // G
      imgData.data[i * 4 + 2] = v; // B
      imgData.data[i * 4 + 3] = 255; // Alpha
    }
    ctx.putImageData(imgData, 0, 0);

    // Overlay minutiae markers on 2D stream
    if (minutiae && minutiae.length > 0) {
      minutiae.forEach(m => {
        ctx.beginPath();
        ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = m.type === 'bifurcation' ? '#e11d48' : '#0284c7';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  }, [currentFrame]);

  // Start Camera Stream
  const startCamera = async (facing = cameraFacing) => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const constraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: 'macro'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setIsCameraActive(true);

      // Check for flashlight/torch capability
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      setHasTorch(Boolean(capabilities.torch));
      setIsTorchOn(false);
    } catch (err) {
      console.warn('Camera access failed:', err);
      setCameraError(err.message || 'Unable to access device camera.');
      setIsCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setIsTorchOn(false);
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setIsTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch toggle not supported:', err);
    }
  };

  // Switch between front/back camera
  const switchCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  // Capture real fingerprint from camera frame
  const captureRealFingerprint = () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([60, 40, 60]);
    }

    try {
      const realBiometricFrame = processCameraVideoFrame(
        videoRef.current,
        128,
        144,
        contrastBoost
      );
      onNewScan(realBiometricFrame);
    } catch (err) {
      alert('Failed to capture finger: ' + err.message);
    } finally {
      setTimeout(() => setIsCapturing(false), 300);
    }
  };

  // Simulator Fallback scan
  const executeSimScan = (patternType = selectedPattern) => {
    if (isScanningSim) return;
    setIsScanningSim(true);
    setScanProgress(0);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([40, 30, 40]);
    }

    let progress = 0;
    const stepTime = 30;
    scanIntervalRef.current = setInterval(() => {
      progress += 2.5;
      if (progress >= 100) {
        clearInterval(scanIntervalRef.current);
        setScanProgress(100);
        setIsScanningSim(false);

        const newFrame = generateFingerprintData(patternType, 128, 144, Math.random());
        onNewScan(newFrame);
      } else {
        setScanProgress(Math.round(progress));
      }
    }, stepTime);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processUploadedImage(file, 128, 144);
      onNewScan(processed);
    } catch (err) {
      alert('Failed to process image: ' + err.message);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 flex flex-col gap-5 shadow-xs">
      {/* Header with Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-900 border border-slate-200">
            <Camera size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Real Finger Optical Scanner
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-sky-50 text-sky-700 border border-sky-200 font-bold uppercase">
                Real Time
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Mobile macro camera & dermal ridge topography
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-full text-xs font-mono">
          <button
            onClick={() => setScanMode('camera')}
            className={`px-3 py-1.5 rounded-full transition cursor-pointer font-semibold ${
              scanMode === 'camera'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Live Camera
          </button>
          <button
            onClick={() => {
              stopCamera();
              setScanMode('simulator');
            }}
            className={`px-3 py-1.5 rounded-full transition cursor-pointer font-semibold ${
              scanMode === 'simulator'
                ? 'bg-slate-950 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sim Fallback
          </button>
        </div>
      </div>

      {/* Mode 1: Real-Time Mobile Camera Scanner */}
      {scanMode === 'camera' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
            {/* Camera Viewport / Live Feed Box */}
            <div className="relative w-full aspect-[4/5] sm:aspect-square max-w-xs mx-auto rounded-2xl bg-slate-950 border border-slate-200 overflow-hidden flex flex-col items-center justify-center text-white shadow-inner">
              {isCameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Anatomical Finger Alignment Reticle */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-36 h-48 border-2 border-dashed border-sky-400/80 rounded-[50px] flex flex-col items-center justify-center bg-sky-500/10 backdrop-blur-[1px]">
                      <div className="w-4 h-4 border-t-2 border-l-2 border-sky-400 absolute top-2 left-2" />
                      <div className="w-4 h-4 border-t-2 border-r-2 border-sky-400 absolute top-2 right-2" />
                      <div className="w-4 h-4 border-b-2 border-l-2 border-sky-400 absolute bottom-2 left-2" />
                      <div className="w-4 h-4 border-b-2 border-r-2 border-sky-400 absolute bottom-2 right-2" />
                      <span className="text-[10px] font-mono font-bold text-sky-200 tracking-wider text-center px-2">
                        ALIGN FINGERPRINT
                      </span>
                    </div>
                  </div>

                  {/* Live status badge */}
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[10px] font-mono text-emerald-400 border border-slate-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>OPTICAL FEED ACTIVE</span>
                  </div>

                  {/* Top right camera controls */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                    {hasTorch && (
                      <button
                        onClick={toggleTorch}
                        title={isTorchOn ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                        className={`p-1.5 rounded-full backdrop-blur-md border transition ${
                          isTorchOn 
                            ? 'bg-amber-400 text-slate-950 border-amber-300' 
                            : 'bg-slate-900/80 text-white border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        {isTorchOn ? <Flashlight size={14} /> : <FlashlightOff size={14} />}
                      </button>
                    )}

                    <button
                      onClick={switchCamera}
                      title="Switch Front/Rear Camera"
                      className="p-1.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white border border-slate-700 hover:bg-slate-800 transition"
                    >
                      <SwitchCamera size={14} />
                    </button>

                    <button
                      onClick={stopCamera}
                      title="Stop Camera Stream"
                      className="p-1.5 rounded-full bg-rose-600/80 backdrop-blur-md text-white border border-rose-500 hover:bg-rose-700 transition"
                    >
                      <StopCircle size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700">
                    <Fingerprint size={28} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">Live Camera Not Active</h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-1 max-w-[220px]">
                      Use your phone's macro camera to scan your real fingertip ridges.
                    </p>
                  </div>
                  <button
                    onClick={() => startCamera('environment')}
                    className="mt-2 px-5 py-2.5 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs uppercase tracking-wide transition shadow-sm cursor-pointer"
                  >
                    Start Real Scanner
                  </button>
                </div>
              )}
            </div>

            {/* 2D Processed Biometric Raster */}
            <div className="flex flex-col items-center">
              <div className="text-[11px] font-mono text-slate-500 mb-1 flex items-center justify-between w-full max-w-[160px]">
                <span>2D RIDGE PROFILE:</span>
                <span className="text-slate-800 font-bold">128×144</span>
              </div>
              <div className="relative p-2 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-inner">
                <canvas 
                  ref={canvas2dRef}
                  className="w-36 h-40 sm:w-40 sm:h-44 rounded-xl border border-slate-300 bg-black block"
                />
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs font-mono text-slate-600">
                <span>Features:</span>
                <span className="font-bold text-emerald-700">
                  {currentFrame?.minutiae?.length || 25} Minutiae Pts
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          {isCameraActive ? (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <button
                onClick={captureRealFingerprint}
                disabled={isCapturing}
                className="w-full py-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition shadow-xs cursor-pointer uppercase active:scale-[0.99]"
              >
                <Fingerprint size={18} />
                <span>{isCapturing ? 'ACQUIRING REAL RIDGES...' : 'CAPTURE REAL FINGERPRINT'}</span>
              </button>

              <div className="flex items-center justify-between text-xs font-mono text-slate-500 px-1">
                <span>RIDGE CONTRAST BOOST: {contrastBoost.toFixed(1)}x</span>
                <input
                  type="range"
                  min="1.0"
                  max="4.0"
                  step="0.2"
                  value={contrastBoost}
                  onChange={(e) => setContrastBoost(parseFloat(e.target.value))}
                  className="w-32 accent-slate-900 cursor-pointer"
                />
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
              <button
                onClick={() => startCamera('environment')}
                className="flex-1 w-full py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs uppercase flex items-center justify-center gap-2 transition shadow-xs cursor-pointer"
              >
                <Camera size={15} />
                <span>OPEN MOBILE CAMERA SCANNER</span>
              </button>

              {/* Native Mobile Camera Photo Snapshot with capture="environment" */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-4 py-3 rounded-2xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition"
              >
                <Upload size={14} />
                <span>Snap Macro Photo</span>
              </button>
            </div>
          )}

          {cameraError && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-mono text-amber-900 flex items-start gap-2">
              <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Camera Notice: </span>
                <span>{cameraError}. You can still snap a close-up photo using the "Snap Macro Photo" button!</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Biometric Mathematical Simulator (Fallback) */}
      {scanMode === 'simulator' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
            {/* Touch Scanning Pad */}
            <div className="flex flex-col items-center">
              <div
                onPointerDown={() => executeSimScan()}
                role="button"
                tabIndex={0}
                className={`relative w-44 h-52 sm:w-48 sm:h-56 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-300 overflow-hidden ${
                  isScanningSim
                    ? 'border-slate-900 bg-slate-50 shadow-md scale-[1.02]'
                    : 'border-slate-200 bg-slate-50/70 hover:border-slate-400 hover:bg-white'
                }`}
              >
                <div className="absolute top-2.5 left-2.5 w-3 h-3 border-t-2 border-l-2 border-slate-400" />
                <div className="absolute top-2.5 right-2.5 w-3 h-3 border-t-2 border-r-2 border-slate-400" />
                <div className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b-2 border-l-2 border-slate-400" />
                <div className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b-2 border-r-2 border-slate-400" />

                {isScanningSim && (
                  <div className="absolute left-0 right-0 h-1 bg-slate-900 shadow-sm animate-laser-light z-20" />
                )}

                <div className={`relative z-10 transition-transform duration-300 ${isScanningSim ? 'scale-110' : ''}`}>
                  <Fingerprint 
                    size={74} 
                    className={`transition-colors duration-300 ${
                      isScanningSim ? 'text-slate-900 animate-pulse' : 'text-slate-400 hover:text-slate-700'
                    }`} 
                  />
                </div>

                <div className="mt-3 text-center z-10">
                  <span className="font-mono text-xs font-bold text-slate-800 tracking-wider block">
                    {isScanningSim ? `ACQUIRING ${scanProgress}%` : 'TOUCH & HOLD'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {isScanningSim ? 'Computing elevation...' : 'Simulate biometric scan'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2D Raster View */}
            <div className="flex flex-col items-center">
              <div className="text-[11px] font-mono text-slate-500 mb-1 flex items-center justify-between w-full max-w-[160px]">
                <span>2D SENSOR RASTER</span>
                <span className="text-slate-800 font-bold">128×144</span>
              </div>
              <div className="relative p-2 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-inner">
                <canvas 
                  ref={canvas2dRef}
                  className="w-36 h-40 sm:w-40 sm:h-44 rounded-xl border border-slate-300 bg-black block"
                />
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs font-mono text-slate-600">
                <span>Features:</span>
                <span className="font-bold text-emerald-700">
                  {currentFrame?.minutiae?.length || 25} Points
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => executeSimScan()}
            disabled={isScanningSim}
            className="w-full py-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition shadow-xs cursor-pointer uppercase active:scale-[0.99]"
          >
            <Zap size={15} />
            <span>+ TRIGGER SIMULATED SCAN</span>
          </button>

          {/* Archetype Selector Pills */}
          <div className="space-y-2 pt-2 border-t border-slate-100 font-mono text-xs">
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>BIOMETRIC ARCHETYPE PATTERN:</span>
              <span>SELECT TO SIMULATE</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PATTERN_TYPES).map(([key, name]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedPattern(name);
                    executeSimScan(name);
                  }}
                  className={`px-3 py-1.5 rounded-full border text-xs transition ${
                    selectedPattern === name
                      ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
