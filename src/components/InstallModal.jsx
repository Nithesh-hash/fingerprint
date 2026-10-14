import React, { useState, useEffect } from 'react';
import { 
  Download, Smartphone, Share2, PlusSquare, 
  CheckCircle2, X, Sparkles, ShieldCheck
} from 'lucide-react';

export default function InstallModal({ onDismiss }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isInstalledSuccess, setIsInstalledSuccess] = useState(false);

  useEffect(() => {
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsStandalone(isStandaloneMode);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleOpenModal = () => {
      setShowGuideModal(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('open-pwa-install-modal', handleOpenModal);

    window.addEventListener('appinstalled', () => {
      setIsInstalledSuccess(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('open-pwa-install-modal', handleOpenModal);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalledSuccess(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowGuideModal(true);
    }
  };

  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Top Banner (Clean Light Styling) */}
      <div className="w-full bg-white border-b border-slate-200/90 px-4 py-3 backdrop-blur-md z-40 relative shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-900">
              <Smartphone size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight">
                  Install IsoMatrix WebApp
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Install on mobile or desktop for full-screen offline access.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <button
              id="btn-install-now"
              onClick={handleInstallClick}
              className="px-4 py-2 rounded-full font-bold text-xs tracking-wide text-white bg-slate-950 hover:bg-slate-800 shadow-xs flex items-center gap-2 transition-all active:scale-95 cursor-pointer uppercase"
            >
              <Download size={14} />
              <span>INSTALL NOW</span>
            </button>

            {onDismiss && (
              <button
                onClick={onDismiss}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 transition"
                title="Dismiss Banner"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Guided Instructions Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 font-mono text-xs text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-slate-800" />
                <span className="font-bold text-sm text-slate-900">
                  Install WebApp on Device
                </span>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-slate-800 text-base"
              >
                ✕
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3">
                <p className="text-slate-600">
                  On Apple iOS Safari, follow these two quick steps:
                </p>

                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="p-2 rounded-xl bg-white text-slate-800 shrink-0 border border-slate-200">
                      <Share2 size={18} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Step 1: Tap Share Icon</span>
                      <span className="text-[11px] text-slate-500">
                        Tap the Share button on the bottom bar of Safari.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="p-2 rounded-xl bg-white text-emerald-600 shrink-0 border border-slate-200">
                      <PlusSquare size={18} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Step 2: Add to Home Screen</span>
                      <span className="text-[11px] text-slate-500">
                        Select <strong className="text-slate-900">"Add to Home Screen"</strong> to install as a standalone app.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-600">
                  To install IsoMatrix on your device:
                </p>

                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="p-2 rounded-xl bg-white text-slate-800 shrink-0 border border-slate-200">
                      <Download size={18} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Address Bar Icon</span>
                      <span className="text-[11px] text-slate-500">
                        Click the Install icon located on the right side of the URL bar (Chrome or Edge).
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="p-2 rounded-xl bg-white text-emerald-600 shrink-0 border border-slate-200">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">Offline Standalone</span>
                      <span className="text-[11px] text-slate-500">
                        Launches full-screen with no browser borders and works offline.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2.5 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs uppercase"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
