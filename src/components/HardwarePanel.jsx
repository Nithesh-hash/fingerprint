import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, Usb, Terminal, CheckCircle2, AlertTriangle, 
  Trash2, Code2, Download, Zap, Copy, Check
} from 'lucide-react';
import { webSerialManager, LOLIN_S2_FIRMWARE_CODE } from '../services/webSerialService';

export default function HardwarePanel({
  onHardwareFrame,
  isHardwareConnected,
  setIsHardwareConnected
}) {
  const [baudRate, setBaudRate] = useState(57600);
  const [logs, setLogs] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showFirmwareModal, setShowFirmwareModal] = useState(false);
  const [copiedFirmware, setCopiedFirmware] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef(null);

  const isWebSerialSupported = webSerialManager.isSupported();

  useEffect(() => {
    webSerialManager.onLogCallback = (logItem) => {
      setLogs((prev) => [...prev.slice(-120), logItem]);
    };

    webSerialManager.onStatusChangeCallback = (connected) => {
      setIsHardwareConnected(connected);
    };

    webSerialManager.onDataCallback = (frame) => {
      if (onHardwareFrame) {
        onHardwareFrame(frame);
      }
    };

    return () => {
      webSerialManager.onLogCallback = null;
      webSerialManager.onStatusChangeCallback = null;
      webSerialManager.onDataCallback = null;
    };
  }, [onHardwareFrame, setIsHardwareConnected]);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleConnectToggle = async () => {
    if (isHardwareConnected) {
      await webSerialManager.disconnect();
    } else {
      setIsConnecting(true);
      try {
        await webSerialManager.connect(baudRate);
      } catch (err) {
        // Handled in service logs
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const handleTriggerCapture = async () => {
    try {
      await webSerialManager.triggerAS608Scan();
    } catch (err) {
      // Ignored
    }
  };

  const handleCopyFirmware = () => {
    navigator.clipboard.writeText(LOLIN_S2_FIRMWARE_CODE);
    setCopiedFirmware(true);
    setTimeout(() => setCopiedFirmware(false), 2000);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 flex flex-col gap-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-900 border border-slate-200">
            <Cpu size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Hardware Serial Interface
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              WEMOS LOLIN S2 Mini + AS608 Optical Sensor
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowFirmwareModal(true);
          }}
          className="px-3.5 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-mono font-medium flex items-center gap-1.5 transition"
        >
          <Code2 size={14} />
          <span>Firmware & Pinout</span>
        </button>
      </div>

      {!isWebSerialSupported && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs font-mono text-amber-900">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-900">WebSerial API Requires Chrome/Edge</div>
            <p className="text-[11px] text-amber-700 mt-0.5">
              To connect physical USB hardware, use Chrome, Edge, Opera, or Android Chrome with experimental web platform flags. Simulation mode is fully functional in all browsers.
            </p>
          </div>
        </div>
      )}

      {/* Connection Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-mono text-slate-500 block mb-1">
            BAUD RATE:
          </label>
          <select
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            disabled={isHardwareConnected}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-400 disabled:opacity-50"
          >
            <option value={9600}>9600 (Debug)</option>
            <option value={57600}>57600 (AS608 Default)</option>
            <option value={115200}>115200 (High Speed)</option>
            <option value={230400}>230400 (Ultra Fast)</option>
            <option value={921600}>921600 (Max LOLIN S2)</option>
          </select>
        </div>

        <div className="sm:col-span-2 flex items-end gap-2">
          <button
            onClick={handleConnectToggle}
            disabled={isConnecting}
            className={`flex-1 py-2.5 px-5 rounded-full font-bold text-xs tracking-wide uppercase flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isHardwareConnected
                ? 'bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100'
                : 'bg-slate-950 hover:bg-slate-800 text-white shadow-xs'
            }`}
          >
            <Usb size={15} />
            <span>
              {isConnecting
                ? 'INITIALIZING...'
                : isHardwareConnected
                ? 'DISCONNECT HARDWARE'
                : '+ CONNECT DEVICE (WEBSERIAL)'}
            </span>
          </button>

          {isHardwareConnected && (
            <button
              onClick={handleTriggerCapture}
              title="Send GenImg capture command"
              className="py-2.5 px-4 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-mono flex items-center gap-1 transition"
            >
              <Zap size={14} />
              <span>CAPTURE</span>
            </button>
          )}
        </div>
      </div>

      {/* Serial Console Monitor */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden text-xs font-mono">
        <div className="flex items-center justify-between px-3.5 py-2 bg-white border-b border-slate-200 text-[11px]">
          <div className="flex items-center gap-2 text-slate-500">
            <Terminal size={14} className="text-slate-800" />
            <span className="font-bold text-slate-800">SERIAL STREAM MONITOR</span>
            <span className="text-slate-300">|</span>
            <span className={isHardwareConnected ? 'text-emerald-600 font-semibold' : 'text-slate-400'}>
              {isHardwareConnected ? 'ONLINE (STREAMING)' : 'OFFLINE'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                autoScroll ? 'bg-slate-100 text-slate-800 font-semibold' : 'text-slate-400'
              }`}
            >
              AUTO-SCROLL
            </button>
            <button
              onClick={() => setLogs([])}
              title="Clear Console"
              className="text-slate-400 hover:text-slate-700 transition"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        <div className="h-32 p-3 overflow-y-auto space-y-1 font-mono text-[11px] leading-relaxed bg-white">
          {logs.length === 0 ? (
            <div className="text-slate-400 italic">
              Terminal ready. Connect LOLIN S2 Mini device to begin stream capture...
            </div>
          ) : (
            logs.map((log, idx) => {
              let color = 'text-slate-600';
              if (log.type === 'success') color = 'text-emerald-600 font-bold';
              if (log.type === 'error') color = 'text-rose-600 font-bold';
              if (log.type === 'warning') color = 'text-amber-600';
              if (log.type === 'data') color = 'text-sky-700';

              return (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-slate-400 shrink-0">[{log.timestamp}]</span>
                  <span className={color}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Firmware & Wiring Modal */}
      {showFirmwareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Code2 size={18} className="text-slate-800" />
                <span className="font-bold text-sm text-slate-900">
                  LOLIN S2 Mini + AS608 Firmware & Wiring Guide
                </span>
              </div>
              <button
                onClick={() => setShowFirmwareModal(false)}
                className="text-slate-400 hover:text-slate-800 text-base"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-slate-800 font-bold block uppercase tracking-wider text-[11px]">
                Hardware Wiring Pinout:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-slate-400">AS608 VCC</div>
                  <div className="text-emerald-700 font-bold">3.3V Pin</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-slate-400">AS608 GND</div>
                  <div className="text-slate-800 font-bold">GND Pin</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-slate-400">AS608 TX</div>
                  <div className="text-sky-700 font-bold">GPIO 16 (RX)</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-slate-400">AS608 RX</div>
                  <div className="text-indigo-700 font-bold">GPIO 18 (TX)</div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">ARDUINO / ESP32 C++ FIRMWARE:</span>
                <button
                  onClick={handleCopyFirmware}
                  className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1 transition"
                >
                  {copiedFirmware ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedFirmware ? 'COPIED!' : 'COPY CODE'}</span>
                </button>
              </div>

              <pre className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 text-[11px] overflow-x-auto max-h-60 leading-relaxed font-mono">
                {LOLIN_S2_FIRMWARE_CODE}
              </pre>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowFirmwareModal(false)}
                className="px-5 py-2.5 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs uppercase"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
