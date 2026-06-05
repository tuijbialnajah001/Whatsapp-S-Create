import React from "react";
import { motion } from "motion/react";
import { AlertCircle } from "lucide-react";

export default function VideoStickerCreate() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full flex-1 flex flex-col items-center justify-center p-8"
    >
      <div className="max-w-md w-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 p-8 rounded-[2.5rem] flex flex-col items-center text-center gap-5 border border-amber-200 dark:border-amber-800/50 shadow-2xl shadow-amber-500/10">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-800/50 rounded-full flex items-center justify-center shadow-inner">
          <AlertCircle className="w-10 h-10" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-amber-700 dark:text-amber-300 mb-3">
            Not Available Yet
          </h2>
          <p className="text-sm font-medium leading-relaxed text-amber-600/90 dark:text-amber-400/80 px-2">
            Animated video to sticker conversion is currently under active
            development. Our team is building this feature. Coming soon!
          </p>
        </div>
      </div>
    </motion.div>
  );
}
