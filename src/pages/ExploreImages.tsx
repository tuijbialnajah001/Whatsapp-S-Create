import React, { useState, useEffect } from 'react';
import { Search, Download, Loader2, CheckCircle2, Circle, CheckSquare, Square, Archive } from 'lucide-react';
import { motion } from 'motion/react';
import JSZip from 'jszip';

// --- Global Cache for RAM & Browser Storage ---
const CACHE_KEY = 'explore_images_state';
const QUERY_CACHE_KEY = 'explore_query_cache';

let memoryCache = {
  images: [] as any[],
  searchQuery: '',
  hasSearched: false,
  selectedIds: new Set<string>()
};

let queryCache: Record<string, any[]> = {};

// Load from session storage on initial script execution
try {
  const savedState = sessionStorage.getItem(CACHE_KEY);
  if (savedState) {
    const parsed = JSON.parse(savedState);
    memoryCache.images = parsed.images || [];
    memoryCache.searchQuery = parsed.searchQuery || '';
    memoryCache.hasSearched = parsed.hasSearched || false;
    memoryCache.selectedIds = new Set(parsed.selectedIds || []);
  }

  const savedQueries = sessionStorage.getItem(QUERY_CACHE_KEY);
  if (savedQueries) {
    queryCache = JSON.parse(savedQueries);
  }
} catch (e) {
  console.error("Failed to load cache", e);
}

// --- Robust Fetch Helpers ---
const fetchWithTimeout = async (url: string, timeoutMs = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

const ImageCard = React.memo(({ img, isSelected, onToggle }: any) => {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
      onClick={() => onToggle(img.id)}
      style={{ 
        transform: 'translateZ(0)',
        willChange: 'transform'
      }}
      className={`relative group rounded-3xl overflow-hidden break-inside-avoid shadow-sm transition-all duration-300 mb-6 cursor-pointer border-4 ${isSelected ? 'border-emerald-500' : 'border-transparent bg-zinc-200 dark:bg-zinc-800'} min-h-[200px]`}
    >
      {!isLoaded && (
        <div className="absolute inset-0 bg-zinc-300/50 dark:bg-zinc-700/50 animate-pulse flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin opacity-50" />
        </div>
      )}
      <img
        src={img.thumbnail || img.url}
        alt={img.title}
        onLoad={() => setIsLoaded(true)}
        className={`w-full object-cover transform transition-all duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'} ${isSelected ? 'scale-105' : 'group-hover:scale-105'}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
      
      {/* Selection Overlay */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${isSelected ? 'bg-emerald-500/20 opacity-100' : 'bg-black/40 opacity-0 group-hover:opacity-100'}`}>
        <div className="absolute top-4 right-4">
          {isSelected ? (
            <CheckCircle2 className="w-8 h-8 text-emerald-500 bg-white rounded-full" />
          ) : (
            <Circle className="w-8 h-8 text-white/70" />
          )}
        </div>
      </div>
    </div>
  );
});

export default function ExploreImages() {
  const [images, setImages] = useState<any[]>(memoryCache.images);
  const [searchQuery, setSearchQuery] = useState(memoryCache.searchQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(memoryCache.selectedIds);
  const [downloadState, setDownloadState] = useState<'none' | 'zip' | 'individual'>('none');
  const [hasSearched, setHasSearched] = useState(memoryCache.hasSearched);

  // Sync state to memory cache and session storage
  useEffect(() => {
    memoryCache.images = images;
    memoryCache.searchQuery = searchQuery;
    memoryCache.hasSearched = hasSearched;
    memoryCache.selectedIds = selectedIds;

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        images,
        searchQuery,
        hasSearched,
        selectedIds: Array.from(selectedIds)
      }));
    } catch (e) {}
  }, [images, searchQuery, hasSearched, selectedIds]);

  const fetchImages = async (query: string) => {
    if (!query.trim()) return;
    
    const normalizedQuery = query.trim().toLowerCase();
    
    // Check query cache first for instant load
    if (queryCache[normalizedQuery]) {
      setImages(queryCache[normalizedQuery]);
      setSelectedIds(new Set());
      setHasSearched(true);
      setError(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    setImages([]);
    setSelectedIds(new Set());
    setHasSearched(true);
    
    try {
      let allResults: any[] = [];
      let currentVqd = "";
      let currentNext = "";
      
      // Fetch up to 5 pages to ensure we hit 250 images
      for (let i = 0; i < 5; i++) {
        if (i > 0 && !currentNext) break;
        if (allResults.length >= 250) break;

        let url = `/api/search?q=${encodeURIComponent(query)}`;
        if (currentVqd) url += `&vqd=${encodeURIComponent(currentVqd)}`;
        if (currentNext) url += `&next=${encodeURIComponent(currentNext)}`;

        const response = await fetchWithTimeout(url, 15000);
        
        if (!response.ok) {
          if (i === 0) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to fetch images from server.");
          } else {
            break; // Stop fetching more pages if one fails, but keep what we have
          }
        }
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          allResults = [...allResults, ...data.results];
          
          // Remove duplicates
          const uniqueResults = Array.from(new Map(allResults.map(item => [item.id, item])).values());
          const currentBatch = uniqueResults.slice(0, 250);
          
          setImages(currentBatch);
          if (i === 0) setLoading(false); // Turn off loading after first batch
          
          // Update query cache
          queryCache[normalizedQuery] = currentBatch;
          try {
            sessionStorage.setItem(QUERY_CACHE_KEY, JSON.stringify(queryCache));
          } catch (e) {}
        } else if (i === 0) {
          throw new Error("No images found for this query.");
        }
        
        currentVqd = data.vqd;
        currentNext = data.next;
      }
    } catch (err: any) {
      console.error("Search Error:", err);
      setError(err.message || "Failed to fetch images. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchImages(searchQuery);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map(img => img.id)));
    }
  };

  const handleDownloadIndividually = async () => {
    if (selectedIds.size === 0) return;
    setDownloadState('individual');
    
    const selectedImgs = images.filter(img => selectedIds.has(img.id));
    
    // Trigger native browser downloads directly by pointing to the proxy with a filename param.
    // This avoids downloading to RAM first and shows native browser progress immediately.
    for (let i = 0; i < selectedImgs.length; i++) {
      const img = selectedImgs[i];
      const safeSearchQuery = searchQuery ? searchQuery.replace(/[^a-z0-9\s]/gi, '_').trim() : 'image';
      const trueUniqueId = Math.random().toString(36).substring(2, 8);
      const filename = `𝙱𝙹𝙴 ~ Clan ${safeSearchQuery} ${i + 1}_${trueUniqueId}.jpg`;
      
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(img.url)}&filename=${encodeURIComponent(filename)}`;
      
      const a = document.createElement('a');
      a.href = proxyUrl;
      a.download = filename; // Fallback for browsers
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Small delay to ensure the browser registers each download separately
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    setDownloadState('none');
    setSelectedIds(new Set()); // Clear selection after successful download
  };

  const handleDownloadAsZip = async () => {
    if (selectedIds.size === 0) return;
    setDownloadState('zip');

    try {
      const selectedImgs = images.filter(img => selectedIds.has(img.id));
      const zip = new JSZip();
      
      // Fetch all images in parallel for the ZIP
      const downloadTasks = selectedImgs.map(async (img, i) => {
        try {
          const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(img.url)}`);
          if (!response.ok) throw new Error("Failed to download image through proxy.");
          const blob = await response.blob();
          return { img, i, blob };
        } catch (error) {
          console.error('Failed to download', img.url, error);
          return null;
        }
      });

      const downloadedBlobs = await Promise.all(downloadTasks);

      downloadedBlobs.forEach((item) => {
        if (!item) return;
        const { i, blob } = item;
        const safeSearchQuery = searchQuery ? searchQuery.replace(/[^a-z0-9\s]/gi, '_').trim() : 'image';
        const trueUniqueId = Math.random().toString(36).substring(2, 8);
        const filename = `𝙱𝙹𝙴 ~ Clan ${safeSearchQuery} ${i + 1}_${trueUniqueId}.jpg`;
        zip.file(filename, blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      // Use explicit MIME type and File constructor to help Android Download Manager
      const explicitBlob = new Blob([zipBlob], { type: 'application/zip' });
      const zipUrl = URL.createObjectURL(explicitBlob);

      const a = document.createElement('a');
      a.href = zipUrl;
      // Use standard characters for the ZIP filename to ensure it shows up in Android Recent Files
      const safeSearchQuery = searchQuery ? searchQuery.replace(/[^a-zA-Z0-9]/g, '_').trim() : 'images';
      a.download = `BJE_Clan_${safeSearchQuery}.zip`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(zipUrl), 1000);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error creating ZIP:", error);
      alert("Failed to create ZIP file.");
    } finally {
      setDownloadState('none');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pb-32"
    >
      {/* Search Bar */}
      <div className="max-w-2xl mx-auto mb-8">
        <form onSubmit={handleSearch} className="relative group flex items-center">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for images..."
            className="w-full pl-14 pr-32 py-4 glass-panel rounded-full text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-lg font-medium"
          />
          <button 
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="absolute right-2 top-2 bottom-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 rounded-full font-bold transition-colors disabled:opacity-50"
          >
            Search
          </button>
        </form>
      </div>

      {/* Action Bar (Select All / Download) */}
      {images.length > 0 && !error && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white/50 dark:bg-zinc-900/50 p-4 rounded-2xl backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/50 sticky top-24 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:text-emerald-500 dark:hover:text-emerald-400 font-semibold transition-colors"
            >
              {selectedIds.size === images.length ? (
                <CheckSquare className="w-5 h-5 text-emerald-500" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              {selectedIds.size === images.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-sm font-medium text-zinc-500">
              {selectedIds.size} selected of {images.length}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadAsZip}
              disabled={selectedIds.size === 0 || downloadState !== 'none'}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5"
            >
              {downloadState === 'zip' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
              Save as ZIP
            </button>
            <button
              onClick={handleDownloadIndividually}
              disabled={selectedIds.size === 0 || downloadState !== 'none'}
              className="flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:-translate-y-0.5"
            >
              {downloadState === 'individual' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download Files
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
            <span className="text-red-500 text-3xl">⚠️</span>
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Oops! Something went wrong</h3>
          <p className="text-zinc-500 max-w-md">{error}</p>
          <button 
            onClick={() => fetchImages(searchQuery)} 
            className="mt-6 px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full font-bold hover:scale-105 transition-transform"
          >
            Try Again
          </button>
        </div>
      ) : loading && images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-6" />
          <p className="text-zinc-500 font-bold text-lg">Searching images...</p>
        </div>
      ) : images.length > 0 ? (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-6 pb-10">
          {images.map((img) => (
            <ImageCard 
              key={img.id} 
              img={img} 
              isSelected={selectedIds.has(img.id)}
              onToggle={toggleSelection}
            />
          ))}
          {/* Show small loader at bottom if still fetching more pages */}
          {loading && images.length > 0 && (
            <div className="col-span-full flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          )}
        </div>
      ) : hasSearched ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
            <Search className="w-10 h-10 text-zinc-400" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">No images found</h3>
          <p className="text-zinc-500 max-w-md">Try searching with different keywords.</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-6">
            <Search className="w-10 h-10 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Search to explore</h3>
          <p className="text-zinc-500 max-w-md">Enter a keyword above to find high-quality images.</p>
        </div>
      )}
    </motion.div>
  );
}
