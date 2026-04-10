import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { Upload, X, CheckCircle2, AlertCircle, Download, MessageCircle, Briefcase, Plus, Crop, Loader2, Settings2, Image as ImageIcon } from 'lucide-react';

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
  "ͲႮᏆᎫᏴᏆᎪᏞΝΑᎫΑΉ·Kҽɳƈԋσ Aʅʅιαɳƈҽ",
  "if you steal my sticker then you're gay/lesbian. Don't you dare baka 😭 ( Tuijbialnajah-frieren-paglu-flat-boobs-lover )",
  "Tuijbialnajah-frieren-paglu-flat-boobs-lover",
  "Powered by Kҽɳƈԋσ Aʅʅιαɳƈҽ"
];

export default function WhatsappSCreate() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [generatedPacks, setGeneratedPacks] = useState<GeneratedPack[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropRatio, setCropRatio] = useState<number>(1);
  const [showInstructions, setShowInstructions] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/cropWorker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { id, cropX, cropY, cropW, cropH, previewUrl } = e.data;

      const imageElement = new Image();
      imageElement.src = previewUrl;
      imageElement.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imageElement, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          canvas.toBlob((blob) => {
            if (blob) {
              const croppedUrl = URL.createObjectURL(blob);
              setImages(current => current.map(i => i.id === id ? { ...i, croppedUrl, isCropping: false } : i));
            }
          }, 'image/webp', 0.9);
        }
      };
    };

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

  const handleFileUpload = async (files: FileList | File[]) => {
    const standardImages: UploadedImage[] = [];
    const zipFiles: File[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        standardImages.push({
          id: Math.random().toString(36).substring(7),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      } else if (file.name.endsWith('.zip')) {
        zipFiles.push(file);
      }
    }
    
    if (standardImages.length > 0) {
      setImages(prev => [...prev, ...standardImages]);
    }
    
    for (const zipFile of zipFiles) {
      try {
        const zip = await JSZip.loadAsync(zipFile);
        const zipEntries = Object.values(zip.files);
        const chunkSize = 10;
        
        for (let i = 0; i < zipEntries.length; i += chunkSize) {
          const chunk = zipEntries.slice(i, i + chunkSize);
          const extractedImages: UploadedImage[] = [];
          
          await Promise.all(chunk.map(async (zipEntry) => {
            if (!zipEntry.dir && zipEntry.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i)) {
              const blob = await zipEntry.async('blob');
              const extractedFile = new File([blob], zipEntry.name, { type: `image/${zipEntry.name.split('.').pop()}` });
              extractedImages.push({
                id: Math.random().toString(36).substring(7),
                file: extractedFile,
                previewUrl: URL.createObjectURL(extractedFile),
              });
            }
          }));
          
          if (extractedImages.length > 0) {
            setImages(prev => [...prev, ...extractedImages]);
          }
          await new Promise(resolve => setTimeout(resolve, 10)); // Yield to render
        }
      } catch (error) {
        console.error("Error extracting ZIP:", error);
        alert("Failed to extract ZIP file.");
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.previewUrl);
      if (img?.croppedUrl) URL.revokeObjectURL(img.croppedUrl);
      return prev.filter(i => i.id !== id);
    });
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

      const content = await zip.generateAsync({ type: 'blob' });
      newGeneratedPacks.push({
        id: pack.id,
        name: pack.settings.name,
        blob: content,
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

  const handleAutoCrop = () => {
    setShowCropModal(false);
    if (!workerRef.current) return;

    setImages(prev => prev.map(img => ({ ...img, isCropping: true })));

    const worker = workerRef.current;

    images.forEach(img => {
      const imageElement = new Image();
      imageElement.src = img.previewUrl;
      imageElement.onload = () => {
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
          worker.postMessage({ 
            id: img.id, 
            imageData, 
            targetRatio: cropRatio,
            origW: imageElement.width,
            origH: imageElement.height,
            previewUrl: img.previewUrl
          });
        }
      };
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] text-gray-900 dark:text-gray-100 font-sans selection:bg-green-500/30">
      {/* Header */}
      <header className="bg-white/80 dark:bg-[#111]/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">StickerStudio</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Stepper */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-200 dark:bg-gray-800 -z-10 rounded-full"></div>
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-green-500 -z-10 transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]" 
              style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
            ></div>
            
            {[
              { num: 1, label: 'Upload', icon: Upload },
              { num: 2, label: 'Organize', icon: Settings2 },
              { num: 3, label: 'Export', icon: Download }
            ].map((s) => (
              <div key={s.num} className="flex flex-col items-center gap-2 bg-[#FAFAFA] dark:bg-[#0A0A0A] px-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  step >= s.num 
                    ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/30' 
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-400'
                }`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <span className={`text-xs font-bold uppercase tracking-wider ${step >= s.num ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="max-w-3xl mx-auto mt-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all opacity-50"></div>
              <div
                className="relative border-2 border-dashed border-green-500/30 dark:border-green-500/20 rounded-3xl p-16 text-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-900 transition-all cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm group-hover:scale-105 transition-transform">
                  <Upload className="w-10 h-10" />
                </div>
                <h2 className="text-3xl font-bold mb-3 text-gray-900 dark:text-white tracking-tight">Drag & Drop Images</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto text-lg">
                  Upload your photos or a ZIP file. We'll automatically extract, crop, and package them for WhatsApp.
                </p>
                <button className="bg-green-500 hover:bg-green-600 text-white px-8 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/40">
                  Browse Files
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple 
                  accept="image/*,.zip" 
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Organize */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Workspace */}
            <div className="lg:col-span-8 flex flex-col">
              <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
                {/* Toolbar */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                    <h2 className="font-semibold text-gray-900 dark:text-white">Canvas <span className="text-gray-400 font-normal text-sm ml-2">({images.length} images)</span></h2>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowCropModal(true)}
                      className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                    >
                      <Crop className="w-4 h-4" /> Auto Crop
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                    >
                      <Plus className="w-4 h-4" /> Add More
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      multiple 
                      accept="image/*,.zip" 
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                    />
                  </div>
                </div>
                
                {/* Grid */}
                <div className="p-6 bg-gray-50/50 dark:bg-black/20 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {images.map((img) => (
                      <div key={img.id} className="group relative aspect-square rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-checkerboard shadow-sm hover:shadow-md transition-all">
                        {img.isCropping ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-sm">
                            <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                          </div>
                        ) : (
                          <img 
                            src={img.croppedUrl || img.previewUrl} 
                            alt="Preview" 
                            className="w-full h-full object-contain p-4 drop-shadow-md transition-transform group-hover:scale-105"
                          />
                        )}
                        <button 
                          onClick={() => removeImage(img.id)}
                          className="absolute top-2 right-2 bg-white dark:bg-gray-800 text-gray-400 hover:text-red-500 p-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Inspector */}
            <div className="lg:col-span-4">
              <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 sticky top-24">
                <div className="flex items-center gap-2 mb-6">
                  <Settings2 className="w-5 h-5 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white tracking-tight">Pack Settings</h3>
                </div>
                
                <div className="space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
                  {packs.map((pack, index) => (
                    <div key={pack.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Pack {index + 1}</h4>
                        <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-full">
                          {pack.images.length}/30
                        </span>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Name</label>
                          <input 
                            type="text" 
                            value={pack.settings.name}
                            onChange={(e) => updatePackSettings(index, 'name', e.target.value)}
                            className="w-full px-3 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Author</label>
                          <select 
                            value={pack.settings.author}
                            onChange={(e) => updatePackSettings(index, 'author', e.target.value)}
                            className="w-full px-3 py-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all appearance-none shadow-sm"
                          >
                            {AUTHORS.map(a => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
                  <button 
                    onClick={generatePacks}
                    disabled={isGenerating || images.length === 0}
                    className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed text-white px-4 py-3.5 rounded-xl font-semibold transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/40 flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Packaging ({progress}%)
                      </>
                    ) : (
                      'Generate Packs'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Export */}
        {step === 3 && (
          <div className="max-w-2xl mx-auto mt-12 text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full mb-8 shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Packs Ready!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-10 text-lg">
              Your stickers have been perfectly cropped and packaged. Download them below.
            </p>

            <div className="space-y-4 mb-10 text-left">
              {generatedPacks.map((pack) => (
                <div key={pack.id} className="bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{pack.name}</h3>
                      <p className="text-sm text-gray-500">WhatsApp Sticker Pack (.wastickers)</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => downloadPack(pack)}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={() => {
                setImages([]);
                setPacks([]);
                setGeneratedPacks([]);
                setStep(1);
              }}
              className="text-gray-500 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
            >
              Create More Stickers
            </button>
          </div>
        )}
      </main>

      {/* Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111] rounded-3xl max-w-md w-full p-8 shadow-2xl border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold tracking-tight">Auto Crop Settings</h3>
              <button onClick={() => setShowCropModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 p-2 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4 mb-8">
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Select the target aspect ratio. Our smart algorithm will find the most interesting part of each image and crop it automatically.
              </p>
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                {[
                  { label: '1:1 (Square)', value: 1 },
                  { label: '4:5 (Portrait)', value: 4/5 },
                  { label: '16:9 (Landscape)', value: 16/9 },
                  { label: '9:16 (Story)', value: 9/16 },
                ].map(ratio => (
                  <button
                    key={ratio.label}
                    onClick={() => setCropRatio(ratio.value)}
                    className={`px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all ${
                      cropRatio === ratio.value 
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 shadow-sm' 
                        : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
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
                className="flex-1 px-4 py-3 rounded-xl font-semibold border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleAutoCrop}
                className="flex-1 px-4 py-3 rounded-xl font-semibold bg-green-500 hover:bg-green-600 text-white transition-colors shadow-lg shadow-green-500/20"
              >
                Start Cropping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111] rounded-3xl max-w-md w-full p-8 shadow-2xl border border-gray-200 dark:border-gray-800 relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-blue-500" /> How to Import
              </h3>
              <button onClick={() => setShowInstructions(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 p-2 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">1</div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Download a Sticker App</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">You need a third-party app like "Sticker Maker" or "Personal Stickers for WhatsApp" installed on your phone.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">2</div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Open the File</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Tap the downloaded .wastickers file and choose to open it with your sticker app.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">3</div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Add to WhatsApp</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">Inside the sticker app, tap "Add to WhatsApp" to import your new pack!</p>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowInstructions(false)}
              className="w-full mt-10 px-4 py-3.5 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
