import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Film,
  Upload,
  Settings2,
  Download,
  AlertCircle,
  Loader2,
  ArrowRight,
  X,
  Play,
  Package,
} from "lucide-react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import JSZip from "jszip";

interface VideoItem {
  id: string;
  file: File;
  originalUrl: string;
  resultUrl?: string;
  status: "pending" | "processing" | "done" | "error";
  progress: number;
}

export default function VideoStickerCreate() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const ffmpegRef = useRef(new FFmpeg());

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length === 0) return;

    // Filter for video/gif files
    const validTypes = [
      "video/mp4",
      "video/webm",
      "image/gif",
      "video/quicktime",
    ];
    const validFiles = files.filter(
      (f: File) => validTypes.includes(f.type) && f.size <= 25 * 1024 * 1024,
    );

    if (validFiles.length < files.length) {
      setGlobalError(
        `Some files were skipped because they exceed the 25MB limit or are unsupported types.`,
      );
    }

    const newVideos = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      originalUrl: URL.createObjectURL(file),
      status: "pending" as const,
      progress: 0,
    }));

    setVideos((prev) => [...prev, ...newVideos]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const validFiles = files.filter((f: File) => f.size <= 25 * 1024 * 1024); // 25MB limit per file
    if (validFiles.length < files.length) {
      setGlobalError(
        `Some files were skipped because they exceed the 25MB limit.`,
      );
    }

    const newVideos = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      originalUrl: URL.createObjectURL(file),
      status: "pending" as const,
      progress: 0,
    }));

    setVideos((prev) => [...prev, ...newVideos]);
  };

  const removeVideo = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  };

  const toBlobURL = async (url: string, mimeType: string) => {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const blob = new Blob([buf], { type: mimeType });
    return URL.createObjectURL(blob);
  };

  const processAll = async () => {
    if (videos.length === 0) return;
    setIsConverting(true);
    setGlobalError(null);

    try {
      const ffmpeg = ffmpegRef.current;

      if (!ffmpeg.loaded) {
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
        await ffmpeg.load({
          coreURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript",
          ),
          wasmURL: await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm",
          ),
        });
      }

      for (let i = 0; i < videos.length; i++) {
        // Skip already done videos
        if (videos[i].status === "done") continue;

        const videoId = videos[i].id;
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoId ? { ...v, status: "processing", progress: 0 } : v,
          ),
        );

        // Listen for progress
        ffmpeg.on("progress", ({ progress }) => {
          setVideos((prev) =>
            prev.map((v) =>
              v.id === videoId && v.status === "processing"
                ? { ...v, progress: Math.max(5, Math.round(progress * 100)) }
                : v,
            ),
          );
        });

        try {
          const inputName = `input_${videoId}.mp4`;
          const outputName = `output_${videoId}.webp`;

          await ffmpeg.writeFile(inputName, await fetchFile(videos[i].file));

          // Max 8s, 24fps, 512x512 crop
          await ffmpeg.exec([
            "-i",
            inputName,
            "-t",
            "8",
            "-vf",
            "fps=24,scale=512:512:force_original_aspect_ratio=increase,crop=512:512",
            "-c:v",
            "libwebp",
            "-lossless",
            "0",
            "-compression_level",
            "4",
            "-q:v",
            "50",
            "-loop",
            "0",
            "-preset",
            "picture",
            "-an",
            "-vsync",
            "0",
            outputName,
          ]);

          const data = await ffmpeg.readFile(outputName);
          const blob = new Blob([data], { type: "image/webp" });
          const url = URL.createObjectURL(blob);

          setVideos((prev) =>
            prev.map((v) =>
              v.id === videoId
                ? { ...v, status: "done", progress: 100, resultUrl: url }
                : v,
            ),
          );

          ffmpeg.deleteFile(inputName);
          ffmpeg.deleteFile(outputName);
        } catch (err) {
          console.error(`Error processing video ${videoId}:`, err);
          setVideos((prev) =>
            prev.map((v) => (v.id === videoId ? { ...v, status: "error" } : v)),
          );
        }

        // Clean up event listener
        ffmpeg.off("progress", () => {});
      }
    } catch (err) {
      console.error(err);
      setGlobalError(
        "Failed to load processing engine. Please reload the page and try again.",
      );
    } finally {
      setIsConverting(false);
    }
  };

  const downloadAll = async () => {
    const doneVideos = videos.filter((v) => v.status === "done" && v.resultUrl);
    if (doneVideos.length === 0) return;

    if (doneVideos.length === 1) {
      // Just download single file
      const a = document.createElement("a");
      a.href = doneVideos[0].resultUrl!;
      a.download = `animated_sticker.webp`;
      a.click();
      return;
    }

    // Pack into ZIP
    const zip = new JSZip();
    const androidFolder = zip.folder("Android");
    if (!androidFolder) return;

    androidFolder.file("title.txt", "Animated Pack");
    androidFolder.file("author.txt", "WA-S-Create");

    for (let i = 0; i < doneVideos.length; i++) {
      const res = await fetch(doneVideos[i].resultUrl!);
      const blob = await res.blob();
      androidFolder.file(`${i + 1}.webp`, blob);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "animated-stickers.zip";
    a.click();
  };

  const pendingCount = videos.filter((v) => v.status === "pending").length;
  const doneCount = videos.filter((v) => v.status === "done").length;
  const canConvert = pendingCount > 0 && !isConverting;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full flex-1 flex flex-col"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col pt-8">
        {globalError && (
          <div className="mb-6 max-w-3xl mx-auto w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-start gap-3 items-center">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{globalError}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {videos.length === 0 ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto w-full flex-1 flex flex-col justify-center"
            >
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="relative group cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => document.getElementById("videoInput")?.click()}
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2.5rem] opacity-10 group-hover:opacity-20 transition duration-500"></div>
                <div className="relative glass-panel rounded-[2.5rem] p-8 sm:p-12 text-center flex flex-col items-center border-2 border-dashed border-emerald-500/30 dark:border-emerald-500/20 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 transition-colors bg-white/30 dark:bg-zinc-900/30">
                  <input
                    id="videoInput"
                    type="file"
                    multiple
                    accept="video/mp4,video/webm,image/gif,video/quicktime"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-500">
                    <Upload className="w-8 h-8 sm:w-10 sm:h-10" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-white tracking-tight">
                    Drop videos here
                  </h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-sm mx-auto text-sm leading-relaxed">
                    MP4, WebM, GIF, MOV.
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById("videoInput")?.click();
                    }}
                    className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-xl font-bold text-base transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center gap-2"
                  >
                    Browse Files <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full mx-auto glass-panel rounded-[2.5rem] p-6 sm:p-8 border border-zinc-200/50 dark:border-zinc-800/50 relative overflow-hidden mb-24"
            >
              <div className="space-y-8">
                <div className="flex flex-wrap gap-4 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <input
                        type="file"
                        multiple
                        accept="video/mp4,video/webm,image/gif,video/quicktime"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <button className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold transition-colors text-sm flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Add More
                      </button>
                    </div>
                    <span className="text-sm font-medium text-zinc-500">
                      {videos.length} videos selected
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {doneCount > 0 && (
                      <button
                        onClick={downloadAll}
                        className="px-5 py-2.5 rounded-xl font-bold text-white bg-zinc-900 dark:bg-white dark:text-zinc-900 hover:scale-105 transition-transform flex items-center gap-2"
                      >
                        <Package className="w-4 h-4" />
                        {doneCount > 1
                          ? `Download ${doneCount} Stickers (ZIP)`
                          : "Download Sticker"}
                      </button>
                    )}

                    {pendingCount > 0 && (
                      <button
                        onClick={processAll}
                        disabled={isConverting}
                        className={`px-6 py-2.5 rounded-xl font-bold text-white shadow-xl flex items-center gap-2 transition-all ${
                          isConverting
                            ? "bg-zinc-400 cursor-not-allowed"
                            : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 hover:scale-105"
                        }`}
                      >
                        {isConverting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />{" "}
                            Processing...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" /> Convert{" "}
                            {pendingCount} Videos
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  <AnimatePresence>
                    {videos.map((video) => (
                      <motion.div
                        key={video.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative group bg-zinc-50 dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm aspect-square flex flex-col"
                      >
                        {!isConverting && video.status !== "processing" && (
                          <button
                            onClick={() => removeVideo(video.id)}
                            className="absolute top-2 right-2 z-20 w-7 h-7 bg-black/50 hover:bg-red-500 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}

                        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                          {video.status === "done" && video.resultUrl ? (
                            <div className="absolute inset-0 bg-checkerboard z-0">
                              <img
                                src={video.resultUrl}
                                alt="Done"
                                className="w-full h-full object-contain relative z-10"
                              />
                            </div>
                          ) : (
                            <video
                              src={video.originalUrl}
                              className="w-full h-full object-cover opacity-70"
                            />
                          )}

                          {/* Status Overlays */}
                          {video.status === "pending" && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-bold rounded-full">
                                Waiting
                              </span>
                            </div>
                          )}

                          {video.status === "processing" && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4">
                              <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mb-2" />
                              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 transition-all duration-300"
                                  style={{ width: `${video.progress}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-white mt-1 font-bold">
                                {video.progress}%
                              </span>
                            </div>
                          )}

                          {video.status === "error" && (
                            <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center p-4">
                              <AlertCircle className="w-6 h-6 text-red-400 mb-1" />
                              <span className="text-[10px] text-white font-bold text-center">
                                Failed
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
