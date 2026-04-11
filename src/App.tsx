/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import WhatsappSCreate from './pages/WhatsappSCreate';
import ExploreImages from './pages/ExploreImages';
import { Sparkles, Image as ImageIcon, Sticker } from 'lucide-react';
import { AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'create' | 'explore'>('create');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-200/20 via-zinc-50 to-zinc-50 dark:from-emerald-900/20 dark:via-zinc-950 dark:to-zinc-950"></div>

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
        <AnimatePresence mode="wait">
          {activeTab === 'create' ? <WhatsappSCreate key="create" /> : <ExploreImages key="explore" />}
        </AnimatePresence>
      </main>
    </div>
  );
}
