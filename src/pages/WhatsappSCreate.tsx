import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { 
  Upload, X, CheckCircle2, AlertCircle, Download, MessageCircle, 
  Briefcase, Plus, Crop, Loader2, Settings2, Image as ImageIcon, 
  Sparkles, ArrowRight, Trash2, Layers, Undo2, Redo2, Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  croppedUrl?: string; // If cropped
  isCropping?: boolean;
}

interface PackSettings {
  name: string;
  author: string;
}

interface Pack {
  id: string;
  images: UploadedImage[];
  settings: PackSettings;
}

interface GeneratedPack {
  id: string;
  name: string;
  blob: Blob;
}

const AUTHORS = [
  "Powered by 𝙱𝙹𝙴 ~ Clan",
  "ͲႮᏆᎫᏴᏆᎪᏞΝΑᎫΑΉ·Kҽɳƈԋσ Aʅʅιαɳƈҽ",
  "if you steal my sticker then you're gay/lesbian. Don't you dare baka 😭 ( Tuijbialnajah-frieren-paglu-flat-boobs-lover )",
  "Tuijbialnajah-frieren-paglu-flat-boobs-lover"
];

const ImageGridItem = React.memo(({ img, removeImage }: { img: UploadedImage, removeImage: (id: string) => void }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
    transition={{ 
      type: "spring", 
      stiffness: 500, 
      damping: 30, 
      mass: 1 
    }}
    className="group relative aspect-square rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-zinc-800 bg-checkerboard shadow-sm transition-shadow duration-300 hover:shadow-md"
  >
    <img 
      src={img.croppedUrl || img.previewUrl} 
      alt="Preview" 
      className="w-full h-full object-contain p-3 drop-shadow-lg transition-transform duration-500 group-hover:scale-105"
      loading="lazy"
      decoding="async"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    
    <button 
      onClick={(e) => {
        e.stopPropagation();
        removeImage(img.id);
      }}
      className="absolute top-2 right-2 bg-white/90 dark:bg-zinc-800/90 text-zinc-500 hover:text-red-500 p-1.5 rounded-full shadow-md transition-all transform hover:scale-110 active:scale-95 z-20 border border-zinc-200 dark:border-zinc-700 md:opacity-0 md:group-hover:opacity-100"
      title="Remove Sticker"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </motion.div>
));

export default function WhatsappSCreate() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [history, setHistory] = useState<UploadedImage[][]>([[]]);
  const [historyPointer, setHistoryPointer] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [generatedPacks, setGeneratedPacks] = useState<GeneratedPack[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropRatio, setCropRatio] = useState<number>(1);
  const [showInstructions, setShowInstructions] = useState(false);
  const [croppingStats, setCroppingStats] = useState({ isActive: false, total: 0, done: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/cropWorker.ts', import.meta.url), { type: 'module' });

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Update packs when images change
  useEffect(() => {
    const newPacks: Pack[] = [];
    for (let i = 0; i < images.length; i += 30) {
      const packImages = images.slice(i, i + 30);
      newPacks.push({
        id: `pack-${i / 30 + 1}`,
        images: packImages,
        settings: packs[i / 30]?.settings || { name: `Sticker Pack ${i / 30 + 1}`, author: AUTHORS[0] },
      });
    }
    setPacks(newPacks);
    if (images.length > 0 && step === 1) {
      setStep(2);
    } else if (images.length === 0 && step === 2) {
      setStep(1);
    }
  }, [images]);

  // History management
  const addToHistory = (newImages: UploadedImage[]) => {
    const newHistory = history.slice(0, historyPointer + 1);
    newHistory.push(newImages);
    if (newHistory.length > 30) newHistory.shift();
    setHistory(newHistory);
    setHistoryPointer(newHistory.length - 1);
    setImages(newImages);
  };

  const undo = () => {
    if (historyPointer > 0) {
      const newPointer = historyPointer - 1;
      setHistoryPointer(newPointer);
      setImages(history[newPointer]);
    }
  };

  const redo = () => {
    if (historyPointer < history.length - 1) {
      const newPointer = historyPointer + 1;
      setHistoryPointer(newPointer);
      setImages(history[newPointer]);
    }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    setIsProcessing(true);
    const standardImages: UploadedImage[] = [];
    const zipFiles: File[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        standardImages.push({
          id: Math.random().toString(36).substring(7) + Date.now(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      } else if (file.name.endsWith('.zip')) {
        zipFiles.push(file);
      }
    }
    
    let currentImages = [...images];
    if (standardImages.length > 0) {
      currentImages = [...currentImages, ...standardImages];
      setImages(currentImages);
    }
    
    for (const zipFile of zipFiles) {
      try {
        const zip = await JSZip.loadAsync(zipFile);
        const zipEntries = Object.values(zip.files).filter(f => !f.dir && f.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i));
        const chunkSize = 15;
        
        for (let i = 0; i < zipEntries.length; i += chunkSize) {
          const chunk = zipEntries.slice(i, i + chunkSize);
          const extractedImages: UploadedImage[] = [];
          
          await Promise.all(chunk.map(async (zipEntry) => {
            const blob = await zipEntry.async('blob');
            const extractedFile = new File([blob], zipEntry.name, { type: `image/${zipEntry.name.split('.').pop()}` });
            extractedImages.push({
              id: Math.random().toString(36).substring(7) + Date.now() + i,
              file: extractedFile,
              previewUrl: URL.createObjectURL(extractedFile),
            });
          }));
          
          if (extractedImages.length > 0) {
            currentImages = [...currentImages, ...extractedImages];
            setImages(currentImages);
          }
          // Small delay to allow UI to breathe
          await new Promise(resolve => setTimeout(resolve, 16));
        }
      } catch (error) {
        console.error("Error extracting ZIP:", error);
      }
    }
    
    addToHistory(currentImages);
    setIsProcessing(false);
  };

  const removeImage = (id: string) => {
    const newImages = images.filter(i => i.id !== id);
    addToHistory(newImages);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const updatePackSettings = (packIndex: number, field: keyof PackSettings, value: string) => {
    setPacks(prev => {
      const newPacks = [...prev];
      newPacks[packIndex] = {
        ...newPacks[packIndex],
        settings: { ...newPacks[packIndex].settings, [field]: value }
      };
      return newPacks;
    });
  };

  const convertToWebP = (imgUrl: string, size: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Failed to get canvas context"));

        // Calculate aspect ratio and center image
        const scale = Math.min(size / img.width, size / img.height);
        const x = (size / 2) - (img.width / 2) * scale;
        const y = (size / 2) - (img.height / 2) * scale;

        // Transparent background
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas to Blob failed"));
        }, 'image/webp', 0.8);
      };
      img.onerror = reject;
      img.src = imgUrl;
    });
  };

  const generatePacks = async () => {
    setIsGenerating(true);
    setProgress(0);
    const newGeneratedPacks: GeneratedPack[] = [];
    
    let totalImages = packs.reduce((acc, pack) => acc + pack.images.length, 0);
    let processedImages = 0;

    for (const pack of packs) {
      const zip = new JSZip();
      zip.file('title.txt', pack.settings.name);
      zip.file('author.txt', pack.settings.author);

      if (pack.images.length > 0) {
        // Tray icon from first image
        const trayBlob = await convertToWebP(pack.images[0].croppedUrl || pack.images[0].previewUrl, 96);
        zip.file('tray.png', trayBlob);

        // Process all images
        for (let i = 0; i < pack.images.length; i++) {
          const img = pack.images[i];
          const webpBlob = await convertToWebP(img.croppedUrl || img.previewUrl, 512);
          zip.file(`${i + 1}.webp`, webpBlob);
          
          processedImages++;
          setProgress(Math.round((processedImages / totalImages) * 100));
        }
      }

      const content = await zip.generateAsync({ type: 'arraybuffer' });
      const wastickersBlob = new Blob([content], { type: 'application/octet-stream' });
      newGeneratedPacks.push({
        id: pack.id,
        name: pack.settings.name,
        blob: wastickersBlob,
      });
    }

    setGeneratedPacks(newGeneratedPacks);
    setIsGenerating(false);
    setStep(3);
  };

  const downloadPack = (pack: GeneratedPack) => {
    const url = URL.createObjectURL(pack.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pack.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.wastickers`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowInstructions(true);
  };

  const handleAutoCrop = async () => {
    setShowCropModal(false);
    if (!workerRef.current || images.length === 0) return;

    setCroppingStats({ isActive: true, total: images.length, done: 0 });

    for (let i = 0; i < images.length; i++) {
      const img = images[i];

      try {
        const imageElement = new Image();
        imageElement.src = img.previewUrl;
        await new Promise((resolve, reject) => {
          imageElement.onload = resolve;
          imageElement.onerror = reject;
        });

        const imgRatio = imageElement.width / imageElement.height;
        
        // Skip if already in the selected ratio (tolerance 0.02)
        if (Math.abs(imgRatio - cropRatio) < 0.02) {
          setCroppingStats(prev => ({ ...prev, done: i + 1 }));
          continue;
        }

        const MAX_SIZE = 256;
        let thumbW = imageElement.width;
        let thumbH = imageElement.height;

        if (thumbW > MAX_SIZE || thumbH > MAX_SIZE) {
          const ratio = Math.min(MAX_SIZE / thumbW, MAX_SIZE / thumbH);
          thumbW = Math.round(thumbW * ratio);
          thumbH = Math.round(thumbH * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = thumbW;
        canvas.height = thumbH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        if (ctx) {
          ctx.drawImage(imageElement, 0, 0, thumbW, thumbH);
          const imageData = ctx.getImageData(0, 0, thumbW, thumbH);
          
          await new Promise<void>((resolveWorker) => {
            const messageHandler = (e: MessageEvent) => {
              if (e.data.id === img.id) {
                workerRef.current?.removeEventListener('message', messageHandler);
                
                const { cropX, cropY, cropW, cropH } = e.data;
                const cropCanvas = document.createElement('canvas');
                cropCanvas.width = cropW;
                cropCanvas.height = cropH;
                const cropCtx = cropCanvas.getContext('2d');
                if (cropCtx) {
                  cropCtx.drawImage(imageElement, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                  cropCanvas.toBlob((blob) => {
                    if (blob) {
                      const croppedUrl = URL.createObjectURL(blob);
                      setImages(current => current.map(item => item.id === img.id ? { ...item, croppedUrl } : item));
                    }
                    resolveWorker();
                  }, 'image/webp', 0.9);
                } else {
                  resolveWorker();
                }
              }
            };
            
            workerRef.current!.addEventListener('message', messageHandler);
            workerRef.current!.postMessage({ 
              id: img.id, 
              imageData, 
              targetRatio: cropRatio,
              origW: imageElement.width,
              origH: imageElement.height,
              previewUrl: img.previewUrl
            });
          });
        }
      } catch (error) {
        console.error("Error cropping image", img.id, error);
      }

      setCroppingStats(prev => ({ ...prev, done: i + 1 }));
      // Yield to main thread to keep UI smooth using requestAnimationFrame
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    }

    setTimeout(() => setCroppingStats({ isActive: false, total: 0, done: 0 }), 500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full flex-1 flex flex-col"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col">
        {/* Stepper */}
        <div className="max-w-2xl mx-auto w-full mb-16">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
                initial={{ width: '0%' }}
                animate={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              />
            </div>
            
            {[
              { num: 1, label: 'Upload', icon: Upload },
              { num: 2, label: 'Organize', icon: Layers },
              { num: 3, label: 'Export', icon: Download }
            ].map((s) => (
              <div key={s.num} className="relative flex flex-col items-center gap-3 bg-zinc-50 dark:bg-zinc-950 px-4">
                <motion.div 
                  animate={{ 
                    scale: step === s.num ? 1.1 : 1,
                    backgroundColor: step >= s.num ? '#10b981' : 'transparent',
                    borderColor: step >= s.num ? '#10b981' : '#d4d4d8'
                  }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                    step >= s.num ? 'text-white shadow-lg shadow-emerald-500/30' : 'text-zinc-400 dark:border-zinc-700'
                  }`}
                >
                  <s.icon className="w-5 h-5" />
                </motion.div>
                <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${step >= s.num ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
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
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2.5rem] opacity-10 group-hover:opacity-20 transition duration-500"></div>
                <div className="relative glass-panel rounded-[2.5rem] p-8 sm:p-12 text-center flex flex-col items-center border-2 border-dashed border-emerald-500/30 dark:border-emerald-500/20 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 transition-colors">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-500">
                    <Upload className="w-8 h-8 sm:w-10 sm:h-10" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-zinc-900 dark:text-white tracking-tight">Drop your files here</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-md mx-auto text-sm sm:text-base leading-relaxed">
                    Upload photos or a ZIP file. We'll extract, smart-crop, and package them into WhatsApp stickers instantly.
                  </p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-xl font-bold text-base transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center gap-2"
                  >
                    Browse Files <ArrowRight className="w-4 h-4" />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    multiple 
                    accept="image/*,.zip,application/zip,application/x-zip-compressed" 
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Step 2: Organize */}
          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1"
            >
              {/* Workspace */}
              <div className="xl:col-span-8 flex flex-col">
                <div className="glass-panel rounded-3xl overflow-hidden flex flex-col h-[700px] shadow-2xl shadow-zinc-200/20 dark:shadow-black/40">
                  {/* Toolbar */}
                  <div className="px-6 py-4 border-b border-zinc-200/50 dark:border-zinc-800/50 flex flex-wrap items-center justify-between gap-4 bg-white/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                        <ImageIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                      </div>
                      <div>
                        <h2 className="font-bold text-zinc-900 dark:text-white leading-tight">Canvas</h2>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{images.length} Stickers</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* History Controls Group */}
                      <div className="flex items-center bg-zinc-100/80 dark:bg-zinc-800/80 rounded-xl p-1 border border-zinc-200/50 dark:border-zinc-700/50">
                        <button 
                          onClick={undo}
                          disabled={historyPointer === 0}
                          className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-20 transition-all hover:bg-white dark:hover:bg-zinc-700 rounded-lg"
                          title="Undo (Ctrl+Z)"
                        >
                          <Undo2 className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-600 mx-1"></div>
                        <button 
                          onClick={redo}
                          disabled={historyPointer === history.length - 1}
                          className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white disabled:opacity-20 transition-all hover:bg-white dark:hover:bg-zinc-700 rounded-lg"
                          title="Redo (Ctrl+Y)"
                        >
                          <Redo2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Action Buttons Group */}
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            if (confirm("Are you sure you want to clear all stickers?")) {
                              addToHistory([]);
                            }
                          }}
                          className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 rounded-xl font-bold text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shadow-sm active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Clear All
                        </button>
                        <button 
                          onClick={() => setShowCropModal(true)}
                          className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all shadow-sm active:scale-95"
                        >
                          <Crop className="w-3.5 h-3.5" /> Smart Crop
                        </button>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Files
                        </button>
                      </div>
                      
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        multiple 
                        accept="image/*,.zip,application/zip,application/x-zip-compressed" 
                        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                      />
                    </div>
                  </div>
                  
                  {/* Grid */}
                  <div className="p-8 bg-zinc-50/30 dark:bg-black/10 flex-1 overflow-y-auto custom-scrollbar">
                    <motion.div 
                      layout
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6"
                    >
                      <AnimatePresence mode="popLayout">
                        {images.map((img) => (
                          <ImageGridItem key={img.id} img={img} removeImage={removeImage} />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* Inspector */}
              <div className="xl:col-span-4">
                <div className="glass-panel rounded-3xl shadow-2xl shadow-zinc-200/20 dark:shadow-black/40 p-6 sticky top-28 flex flex-col max-h-[700px]">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <Settings2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Pack Settings</h3>
                  </div>
                  
                  <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
                    {packs.map((pack, index) => (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        key={pack.id} 
                        className="bg-white dark:bg-zinc-900/50 rounded-2xl p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:border-emerald-500/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <h4 className="font-bold text-zinc-900 dark:text-white">Pack {index + 1}</h4>
                          </div>
                          <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                            {pack.images.length} / 30
                          </span>
                        </div>
                        
                        <div className="space-y-5">
                          <div>
                            <label className="block text-[10px] font-black text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-[0.2em]">Pack Name</label>
                            <input 
                              type="text" 
                              placeholder="Enter pack name..."
                              value={pack.settings.name}
                              onChange={(e) => updatePackSettings(index, 'name', e.target.value)}
                              className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all shadow-inner"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-zinc-400 dark:text-zinc-500 mb-2 uppercase tracking-[0.2em]">Author</label>
                            <div className="relative">
                              <select 
                                value={pack.settings.author}
                                onChange={(e) => updatePackSettings(index, 'author', e.target.value)}
                                className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none shadow-inner pr-10 cursor-pointer"
                              >
                                {AUTHORS.map(a => <option key={a} value={a}>{a}</option>)}
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <button 
                      onClick={generatePacks}
                      disabled={isGenerating || images.length === 0}
                      className="relative w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-zinc-300 disabled:to-zinc-300 dark:disabled:from-zinc-800 dark:disabled:to-zinc-800 disabled:text-zinc-500 text-white px-4 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 flex items-center justify-center gap-2 overflow-hidden"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Packaging ({progress}%)
                          <div className="absolute bottom-0 left-0 h-1 bg-white/30" style={{ width: `${progress}%` }}></div>
                        </>
                      ) : (
                        <>Generate Packs <ArrowRight className="w-5 h-5" /></>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Export */}
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
              <h2 className="text-5xl font-extrabold mb-4 tracking-tight text-zinc-900 dark:text-white">Ready to Share!</h2>
              <p className="text-zinc-500 dark:text-zinc-400 mb-12 text-lg">
                Your stickers are perfectly packaged. Download them and import directly into WhatsApp.
              </p>

              <div className="space-y-4 mb-12 text-left">
                {generatedPacks.map((pack, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={pack.id} 
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Briefcase className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{pack.name}</h3>
                        <p className="text-sm font-medium text-zinc-500">.wastickers format</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => downloadPack(pack)}
                      className="flex items-center gap-2 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-6 py-3 rounded-xl font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
                  </motion.div>
                ))}
              </div>

              <button 
                onClick={() => {
                  setImages([]);
                  setPacks([]);
                  setGeneratedPacks([]);
                  setStep(1);
                }}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-bold transition-colors flex items-center justify-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" /> Create Another Pack
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Processing Loading Overlay */}
      <AnimatePresence>
        {(croppingStats.isActive || isProcessing) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 flex flex-col items-center text-center"
            >
              <div className="relative w-24 h-24 mb-8">
                <svg className="animate-spin w-full h-full text-emerald-500" viewBox="0 0 24 24">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none"></circle>
                  <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {croppingStats.isActive && (
                  <div className="absolute inset-0 flex items-center justify-center text-lg font-black text-zinc-900 dark:text-white">
                    {Math.round((croppingStats.done / croppingStats.total) * 100) || 0}%
                  </div>
                )}
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2 tracking-tight">
                {croppingStats.isActive ? 'Smart Cropping' : 'Processing Images'}
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8">
                {croppingStats.isActive 
                  ? `Analyzing image ${croppingStats.done} of ${croppingStats.total}`
                  : 'Preparing your stickers, please wait...'}
              </p>
              {croppingStats.isActive && (
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full rounded-full" 
                    initial={{ width: 0 }}
                    animate={{ width: `${(croppingStats.done / croppingStats.total) * 100}%` }}
                    transition={{ ease: "easeOut" }}
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crop Modal */}
      <AnimatePresence>
        {showCropModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] max-w-md w-full p-8 shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Aspect Ratio</h3>
                <button onClick={() => setShowCropModal(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4 mb-8">
                <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                  Select the target aspect ratio. Our AI will find the most interesting part of each image and crop it perfectly.
                </p>
                
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {[
                    { label: '1:1 (Square)', value: 1 },
                    { label: '4:5 (Portrait)', value: 4/5 },
                    { label: '16:9 (Landscape)', value: 16/9 },
                    { label: '9:16 (Story)', value: 9/16 },
                  ].map(ratio => (
                    <button
                      key={ratio.label}
                      onClick={() => setCropRatio(ratio.value)}
                      className={`px-4 py-4 rounded-2xl border-2 text-sm font-bold transition-all ${
                        cropRatio === ratio.value 
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 shadow-md shadow-emerald-500/10' 
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCropModal(false)}
                  className="flex-1 px-4 py-4 rounded-2xl font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAutoCrop}
                  className="flex-1 px-4 py-4 rounded-2xl font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
                >
                  Start Cropping
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions Modal */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[2.5rem] max-w-md w-full p-8 shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold tracking-tight flex items-center gap-3 text-zinc-900 dark:text-white">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  How to Import
                </h3>
                <button onClick={() => setShowInstructions(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 p-2.5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-8">
                <div className="flex gap-5">
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xl shadow-inner">1</div>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-white mb-1.5 text-lg">Download App</h4>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">Install a third-party app like "Sticker Maker" or "Personal Stickers for WhatsApp".</p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xl shadow-inner">2</div>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-white mb-1.5 text-lg">Open the File</h4>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">Tap the downloaded .wastickers file and choose to open it with your sticker app.</p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xl shadow-inner">3</div>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-white mb-1.5 text-lg">Add to WhatsApp</h4>
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed">Inside the sticker app, tap "Add to WhatsApp" to import your new pack!</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowInstructions(false)}
                className="w-full mt-10 px-4 py-4 rounded-2xl font-bold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5"
              >
                Got it, thanks!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
