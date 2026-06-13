import google from 'googlethis';

// Helper to prevent hanging fetches
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// Global in-memory cache for VQD tokens to speed up repeated or related searches
// Note: In serverless environments like Vercel, this is only preserved during warm starts.
const vqdCache = new Map<string, { token: string, expiry: number }>();
const VQD_TTL = 1000 * 60 * 10; // 10 minutes

export default async function handler(req: any, res: any) {
  const query = req.query.q as string;
  const vqdParam = req.query.vqd as string;
  const nextParam = req.query.next as string;

  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required" });
  }

  try {
    let vqd = vqdParam;
    
    // Step 1: Get VQD token if not provided
    if (!vqd) {
      const normalizedQuery = query.trim().toLowerCase();
      const cached = vqdCache.get(normalizedQuery);
      if (cached && cached.expiry > Date.now()) {
        vqd = cached.token;
      }
    }

    if (!vqd) {
      const randIp = '17.' + Math.floor(Math.random()*256) + '.' + Math.floor(Math.random()*256) + '.' + Math.floor(Math.random()*256);
      let html = "";
      
      try {
        // Direct DDG fetch - fast timeout for Vercel
        const ddgHtmlRes = await fetchWithTimeout(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&ia=web`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "X-Forwarded-For": randIp,
            "True-Client-IP": randIp,
            "Accept-Language": "en-US,en;q=0.9"
          }
        }, 2500);
        html = await ddgHtmlRes.text();
      } catch(e) {}
      
      let vqdMatch = html.match(/vqd=['"]?([^&'"\s>]+)['"]?/);
      if (!vqdMatch) {
          try {
            const proxyRes = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent('https://duckduckgo.com/?q=' + query)}`, {}, 5000);
            html = await proxyRes.text();
            vqdMatch = html.match(/vqd=['"]?([^&'"\s>]+)['"]?/);
          } catch(e) {}
      }
        
      if (vqdMatch && vqdMatch[1]) {
        vqd = vqdMatch[1];
        vqdCache.set(query.trim().toLowerCase(), { token: vqd, expiry: Date.now() + VQD_TTL });
      } else {
          try {
            const fallbackRes = await fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent('https://duckduckgo.com/?q=' + query)}`, {}, 5000);
            html = await fallbackRes.text();
            vqdMatch = html.match(/vqd=['"]?([^&'"\s>]+)['"]?/);
            if (vqdMatch && vqdMatch[1]) {
              vqd = vqdMatch[1];
              vqdCache.set(query.trim().toLowerCase(), { token: vqd, expiry: Date.now() + VQD_TTL });
            }
          } catch (e) {}
      }
    }

    if (vqd) {
      // Step 2: Fetch Images from DuckDuckGo
      // p=1 means Strict SafeSearch in DuckDuckGo
      let url = "";
      if (nextParam) {
        // Fix missing slash if nextParam doesn't have it
        const safeNext = nextParam.startsWith('/') ? nextParam : `/${nextParam}`;
        url = `https://duckduckgo.com${safeNext}&vqd=${vqd}`;
      } else {
        url = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`;
      }

      let searchRes = await fetchWithTimeout(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "Referer": "https://duckduckgo.com/",
          "X-Forwarded-For": '17.' + Math.floor(Math.random()*256) + '.' + Math.floor(Math.random()*256) + '.' + Math.floor(Math.random()*256),
          "Accept-Language": "en-US,en;q=0.9"
        }
      });

      let data: any;
      
      if (!searchRes.ok) {
          // Fallback to proxy
          try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            searchRes = await fetchWithTimeout(proxyUrl);
            if (searchRes.ok) {
              data = await searchRes.json();
            }
          } catch (e) {
            // ignore
          }
      } else {
          data = await searchRes.json();
      }

      if (data && data.results && data.results.length > 0) {
        const mappedResults = data.results.map((item: any) => ({
          id: item.image,
          url: item.image,
          thumbnail: item.thumbnail,
          title: item.title,
          width: item.width,
          height: item.height
        }));

        return res.json({
          results: mappedResults,
          vqd: vqd,
          next: data.next
        });
      }
    }

    // IF DUCKDUCKGO FAILS OR IS BLOCKED BY VERCEL, WE FALLBACK TO GOOGLE IMAGE SEARCH
    console.log("DuckDuckGo failed or was blocked by Vercel. Falling back to Google Image Search...");
    
    const googleImages = await google.image(query, { safe: true });
    
    if (googleImages && googleImages.length > 0) {
      const mappedGoogleResults = googleImages.map((item: any) => ({
        id: item.id || item.url,
        url: item.url,
        thumbnail: item.preview?.url || item.url,
        title: item.origin?.title || query,
        width: item.width || 800,
        height: item.height || 600
      }));

      return res.json({
        results: mappedGoogleResults,
        vqd: vqd || "google-fallback", // return a fake vqd to prevent errors
        next: null // googlethis doesn't easily support pagination natively without options, we just return the top 100
      });
    }

    throw new Error("Could not acquire search results from DuckDuckGo or Google.");

  } catch (error: any) {
    // If EVERYTHING fails, we try the absolute last resort fallback
    try {
        console.error("DuckDuckGo and Google Image Search both failed. Falling back to safe final fallback...", error.message);
        const googleImages = await google.image(query, { safe: true });
        if (googleImages && googleImages.length > 0) {
          const mappedGoogleResults = googleImages.map((item: any) => ({
            id: item.id || item.url,
            url: item.url,
            thumbnail: item.preview?.url || item.url,
            title: item.origin?.title || query,
            width: item.width || 800,
            height: item.height || 600
          }));
          return res.json({ results: mappedGoogleResults, vqd: "google-fallback", next: null });
        }
    } catch(e) {}
    
    console.error("Search API Error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch images" });
  }
}

