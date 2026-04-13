/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import WhatsappSCreate from './pages/WhatsappSCreate';
import ExploreImages from './pages/ExploreImages';
import { Sparkles, Image as ImageIcon, Sticker, Bug, X, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'create' | 'explore'>('create');
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [bugDescription, setBugDescription] = useState('');

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

      {/* Bug Report Button */}
      <button
        onClick={() => setIsBugModalOpen(true)}
        className="fixed top-4 right-4 z-50 p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-lg text-zinc-600 dark:text-zinc-400 hover:text-red-500 hover:border-red-500/50 dark:hover:text-red-400 dark:hover:border-red-500/50 transition-all hover:scale-105 active:scale-95"
        title="Report a Bug"
      >
        <Bug className="w-5 h-5" />
      </button>

      {/* Floating Header & Toggle */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex items-center w-max max-w-[95%]">
        <div className="glass-panel rounded-full p-1.5 flex items-center shadow-lg border border-white/20 dark:border-zinc-800/50">
          {/* Branding */}
          <div className="hidden sm:flex items-center gap-2 px-4 border-r border-zinc-200/50 dark:border-zinc-700/50 mr-1">
            <div className="w-6 h-6 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full flex items-center justify-center shadow-inner">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <h1 className="font-bold text-sm text-zinc-900 dark:text-white tracking-tight">WA-S-Create</h1>
          </div>

          {/* Toggle */}
          <div className="flex items-center relative w-[220px] sm:w-[240px]">
            <div 
              className="absolute inset-y-0 w-1/2 bg-zinc-900 dark:bg-white rounded-full transition-transform duration-300 ease-out shadow-md"
              style={{ transform: activeTab === 'create' ? 'translateX(0)' : 'translateX(100%)' }}
            ></div>
            <button 
              onClick={() => setActiveTab('create')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-bold rounded-full transition-colors ${activeTab === 'create' ? 'text-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <Sticker className="w-4 h-4" /> Create
            </button>
            <button 
              onClick={() => setActiveTab('explore')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-bold rounded-full transition-colors ${activeTab === 'explore' ? 'text-white dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              <ImageIcon className="w-4 h-4" /> Explore
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-24 pb-20 min-h-screen flex flex-col">
        <div className={activeTab === 'create' ? 'flex flex-col flex-1' : 'hidden'}>
          <WhatsappSCreate />
        </div>
        <div className={activeTab === 'explore' ? 'flex flex-col flex-1' : 'hidden'}>
          <ExploreImages />
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <div className="glass-panel px-5 py-2.5 rounded-full shadow-lg border border-white/20 dark:border-zinc-800/50 backdrop-blur-md bg-white/70 dark:bg-zinc-900/70">
          <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wide">
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
