import React, { useState, useRef, useEffect } from "react";
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
  CheckCircle2,
  Package,
  Check,
  Sticker,
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
  statusText?: string;
}

export default function VideoStickerCreate() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isConverting, setIsConverting] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (videos.length > 0 && step === 1) {
      setStep(2);
    } else if (videos.length === 0 && step === 2) {
      setStep(1);
    }

    if (step === 2 && !isConverting && videos.length > 0) {
      const pendingCount = videos.filter((v) => v.status === "pending").length;
      const processingCount = videos.filter(
        (v) => v.status === "processing",
      ).length;
      const doneCount = videos.filter((v) => v.status === "done").length;

      if (pendingCount === 0 && processingCount === 0 && doneCount > 0) {
        setStep(3);
      }
    }
  }, [videos, step, isConverting]);

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
        setVideos((prev) =>
          prev.map((v) =>
            v.status === "pending"
              ? { ...v, statusText: "Setting up core..." }
              : v,
          ),
        );

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
            v.id === videoId
              ? {
                  ...v,
                  status: "processing",
                  progress: 5,
                  statusText: "Writing media...",
                }
              : v,
          ),
        );

        // Listen for progress
        const progressCallback = ({ progress }: any) => {
          setVideos((prev) =>
            prev.map((v) =>
              v.id === videoId && v.status === "processing"
                ? {
                    ...v,
                    progress: Math.max(
                      10,
                      Math.min(95, Math.round(progress * 100)),
                    ),
                    statusText: `Encoding WebP (${Math.round(progress * 100)}%)`,
                  }
                : v,
            ),
          );
        };
        ffmpeg.on("progress", progressCallback);

        // Add logging for debugging
        const logCallback = ({ message }: { message: string }) => {
          console.log(`[ffmpeg ${videoId}]`, message);
          let text = "";
          if (message.includes("frame=")) {
            const match = message.match(/frame=\s*(\d+)/);
            if (match) {
              text = `Processing Frame ${match[1]}`;
            }
          } else if (message.includes("Output #0")) {
            text = "Encoding WebP...";
          }
          if (text) {
            setVideos((prev) =>
              prev.map((v) =>
                v.id === videoId && v.status === "processing"
                  ? { ...v, statusText: text }
                  : v,
              ),
            );
          }
        };
        ffmpeg.on("log", logCallback);

        try {
          const inputName = `input_${videoId}.mp4`;
          const outputName = `output_${videoId}.webp`;

          await ffmpeg.writeFile(inputName, await fetchFile(videos[i].file));

          // Use -y to overwrite, and optimize webp settings for speed
          const execCode = await ffmpeg.exec([
            "-y",
            "-i",
            inputName,
            "-t",
            "8", // crop and limit to first 8 seconds
            "-vf",
            "fps=12,scale=512:512:force_original_aspect_ratio=increase,crop=512:512", // 1:1 center-cropped downscaling
            "-c:v",
            "libwebp",
            "-lossless",
            "0",
            "-q:v",
            "45", // optimized quality/size ratio for WhatsApp rules
            "-preset",
            "default",
            "-loop",
            "0",
            "-an",
            outputName,
          ]);

          if (execCode !== 0) {
            throw new Error(`FFmpeg exited with code ${execCode}`);
          }

          const data = await ffmpeg.readFile(outputName);
          const blob = new Blob([data], { type: "image/webp" });
          const url = URL.createObjectURL(blob);

          setVideos((prev) =>
            prev.map((v) =>
              v.id === videoId
                ? {
                    ...v,
                    status: "done",
                    progress: 100,
                    statusText: "Completed",
                    resultUrl: url,
                  }
                : v,
            ),
          );

          ffmpeg.deleteFile(inputName);
          ffmpeg.deleteFile(outputName);
        } catch (err) {
          console.error(`Error processing video ${videoId}:`, err);
          setVideos((prev) =>
            prev.map((v) =>
              v.id === videoId
                ? { ...v, status: "error", statusText: "Conversion Failed" }
                : v,
            ),
          );
        } finally {
          // Clean up event listeners
          ffmpeg.off("progress", progressCallback);
          ffmpeg.off("log", logCallback);
        }
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

  const handleCreateStickerPack = async () => {
    const doneVideos = videos.filter((v) => v.status === "done" && v.resultUrl);
    if (doneVideos.length === 0) return;
    setIsTransferring(true);
    setGlobalError(null);

    try {
      const files: File[] = [];

      for (let i = 0; i < doneVideos.length; i++) {
        const video = doneVideos[i];
        const response = await fetch(video.resultUrl!);
        const blob = await response.blob();

        const timestamp = Date.now();
        const filename = `animated_sticker_${i + 1}_${timestamp}.webp`;
        const file = new File([blob], filename, {
          type: "image/webp",
        });
        files.push(file);
      }

      window.dispatchEvent(
        new CustomEvent("navigate-tab", { detail: "create" }),
      );

      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("import-files", { detail: files }),
        );
      }, 100);
    } catch (err) {
      console.error(err);
      setGlobalError(
        "Failed to transfer stickers to the pack. Please try again.",
      );
    } finally {
      setIsTransferring(false);
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

        {/* Step Indicator */}
        <div className="max-w-3xl mx-auto w-full mb-12">
          <div className="flex items-center justify-between relative px-2">
            {/* Background Line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-100 dark:bg-zinc-800 -translate-y-1/2 rounded-full z-0" />

            {/* Active Highlight Line */}
            <div
              className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 -translate-y-1/2 rounded-full transition-all duration-500 z-0"
              style={{
                width: step === 1 ? "0%" : step === 2 ? "50%" : "100%",
              }}
            />

            {[
              { num: 1, title: "Upload", desc: "Select source video" },
              { num: 2, title: "Process", desc: "Crop, Square & Compress" },
              { num: 3, title: "Sticker Pack", desc: "Convert to pack" },
            ].map((s) => {
              const isCompleted = step > s.num;
              const isActive = step === s.num;
              return (
                <div
                  key={s.num}
                  className="flex flex-col items-center relative z-10"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 ${
                      isCompleted
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/10"
                        : isActive
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xl scale-110"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 border border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : s.num}
                  </div>
                  <span
                    className={`text-xs font-bold mt-2 ${
                      isActive
                        ? "text-emerald-500"
                        : isCompleted
                          ? "text-zinc-700 dark:text-zinc-300"
                          : "text-zinc-400"
                    }`}
                  >
                    {s.title}
                  </span>
                  <span className="hidden sm:inline text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {s.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
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
          )}

          {step === 2 && (
            <motion.div
              key="step2"
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
                              <span className="text-[10px] text-white mt-1 font-bold text-center">
                                {video.progress}%
                              </span>
                              {video.statusText && (
                                <span className="text-[9px] text-zinc-300 mt-1 font-medium text-center truncate max-w-full px-1">
                                  {video.statusText}
                                </span>
                              )}
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

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto mt-12 text-center glass-panel p-12 rounded-[3rem]"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="inline-flex items-center justify-center w-28 h-28 bg-gradient-to-tr from-emerald-400 to-teal-500 text-white rounded-full mb-8 shadow-2xl shadow-emerald-500/30"
              >
                <CheckCircle2 className="w-14 h-14" />
              </motion.div>
              <h2 className="text-5xl font-extrabold mb-4 tracking-tight text-zinc-900 dark:text-white">
                Ready to Share!
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 mb-12 text-lg">
                Your animated stickers are ready. Convert them directly into a
                sticker pack or download them!
              </p>

              <div className="flex flex-col gap-4 max-w-sm mx-auto">
                <button
                  onClick={handleCreateStickerPack}
                  disabled={isTransferring}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 px-8 rounded-full font-bold text-lg hover:scale-105 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
                >
                  {isTransferring ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Sticker className="w-6 h-6 text-emerald-100" />
                      Convert to Sticker Pack
                    </>
                  )}
                </button>
                <button
                  onClick={downloadAll}
                  className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-4 px-8 rounded-full font-bold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-3 shadow-md"
                >
                  <Package className="w-6 h-6" />
                  Download ZIP
                </button>
                <button
                  onClick={() => {
                    setVideos([]);
                    setStep(1);
                  }}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white py-4 px-8 rounded-full font-bold text-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:scale-105 transition-all"
                >
                  Create More
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
