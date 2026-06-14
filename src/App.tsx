/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import WhatsappSCreate from './pages/WhatsappSCreate';
import ExploreImages from './pages/ExploreImages';
import VideoStickerCreate from './pages/VideoStickerCreate';
import { Sparkles, Image as ImageIcon, Sticker, Bug, X, Send, Download, Film, Compass } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'create' | 'explore' | 'video'>('create');
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleNav = (e: any) => {
      if (e.detail && ['create', 'video', 'explore'].includes(e.detail)) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener('navigate-tab', handleNav);
    return () => window.removeEventListener('navigate-tab', handleNav);
  }, []);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.log('SW registration failed: ', err);
        });
      });
    }

    // Handle PWA install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!localStorage.getItem('hasSeenInstallPrompt')) {
        setIsInstallable(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      localStorage.setItem('hasSeenInstallPrompt', 'true');
    }
    setDeferredPrompt(null);
  };

  const dismissInstallPrompt = () => {
    setIsInstallable(false);
    localStorage.setItem('hasSeenInstallPrompt', 'true');
  };

  const handleBugSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugDescription.trim()) return;
    
    const subject = encodeURIComponent('Bug Report - WA-S-Create');
    const body = encodeURIComponent(`Problem Description:\n\n${bugDescription}`);
    window.location.href = `mailto:bjeclanofficial@gmail.com?subject=${subject}&body=${body}`;
    
    setIsBugModalOpen(false);
    setBugDescription('');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-200/20 via-zinc-50 to-zinc-50 dark:from-emerald-900/20 dark:via-zinc-950 dark:to-zinc-950"></div>

      {/* PWA Install Notification Modal */}
      <AnimatePresence>
        {isInstallable && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-[400px] z-[110] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col sm:flex-row gap-4 items-center justify-between"
          >
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 shrink-0 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center shadow-inner">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">Install Whatsapp Sticker Pack Generator</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Faster, better, offline.
                </p>
              </div>
            </div>
            
            <div className="flex shrink-0 gap-2 w-full sm:w-auto">
              <button
                onClick={dismissInstallPrompt}
                className="flex-1 sm:flex-none py-2 px-3 rounded-lg font-bold text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Not Now
              </button>
              <button
                onClick={handleInstallClick}
                className="flex-1 sm:flex-none py-2 px-4 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-bold text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
              >
                <Download className="w-3 h-3" /> Install
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bug Report Button */}
      <button
        onClick={() => setIsBugModalOpen(true)}
        className="fixed bottom-6 right-6 z-50 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-xl text-zinc-600 dark:text-zinc-400 hover:text-red-500 hover:border-red-500/50 dark:hover:text-red-400 dark:hover:border-red-500/50 transition-all hover:scale-105 active:scale-95"
        title="Report a Bug"
      >
        <Bug className="w-6 h-6" />
      </button>

      {/* Floating Header & Toggle */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center w-full max-w-[calc(100%-2rem)] sm:w-max">
        <div className="glass-panel w-full rounded-full p-1.5 flex items-center shadow-lg border border-white/20 dark:border-zinc-800/50 justify-between sm:justify-start">
          {/* Branding */}
          <div className="hidden sm:flex items-center gap-2 px-3 border-r border-zinc-200/50 dark:border-zinc-700/50 mr-1 shrink-0">
            <div className="w-5 h-5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center shadow-inner">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </div>
            <h1 className="font-bold text-xs text-zinc-900 dark:text-white tracking-tight">WA-S-Create</h1>
          </div>

          {/* Toggle */}
          <div className="flex flex-1 items-center relative w-full sm:w-[180px]">
            <div 
              className="absolute inset-y-0 w-1/3 bg-zinc-900 dark:bg-white rounded-full transition-transform duration-300 ease-out shadow-md"
              style={{ transform: activeTab === 'create' ? 'translateX(0)' : activeTab === 'video' ? 'translateX(100%)' : 'translateX(200%)' }}
            ></div>
            <button 
              onClick={() => setActiveTab('create')}
              title="Image to Sticker"
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${activeTab === 'create' ? 'text-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <ImageIcon className="w-4.5 h-4.5" />
            </button>
            <button 
              onClick={() => setActiveTab('video')}
              title="Video to Sticker"
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${activeTab === 'video' ? 'text-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <Film className="w-4.5 h-4.5" />
            </button>
            <button 
              onClick={() => setActiveTab('explore')}
              title="Explore Stickers"
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 transition-colors ${activeTab === 'explore' ? 'text-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <Compass className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-24 pb-20 min-h-screen flex flex-col">
        <div className={activeTab === 'create' ? 'flex flex-col flex-1' : 'hidden'}>
          <WhatsappSCreate />
        </div>
        <div className={activeTab === 'video' ? 'flex flex-col flex-1' : 'hidden'}>
          <VideoStickerCreate />
        </div>
        <div className={activeTab === 'explore' ? 'flex flex-col flex-1' : 'hidden'}>
          <ExploreImages />
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <div className="glass-panel px-5 py-2.5 rounded-full shadow-lg border border-white/20 dark:border-zinc-800/50 backdrop-blur-md bg-white/70 dark:bg-zinc-900/70">
          <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wide whitespace-nowrap">
            Powered by <span className="text-emerald-600 dark:text-emerald-400">𝙱𝙹𝙴 ~ Clan</span>
          </p>
        </div>
      </footer>

      {/* Bug Report Modal */}
      <AnimatePresence>
        {isBugModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBugModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                    <Bug className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Report a Bug</h3>
                </div>
                <button 
                  onClick={() => setIsBugModalOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleBugSubmit} className="p-6">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Found an issue? Describe it below and we'll redirect you to your email client to send it to us.
                </p>
                <textarea
                  value={bugDescription}
                  onChange={(e) => setBugDescription(e.target.value)}
                  placeholder="Describe the problem you encountered..."
                  className="w-full h-32 p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50 text-zinc-900 dark:text-white placeholder-zinc-400 mb-6"
                  required
                />
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBugModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!bugDescription.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" /> Submit via Email
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
