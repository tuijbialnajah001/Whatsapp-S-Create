import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

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
const vqdCache = new Map<string, { token: string, expiry: number }>();
const VQD_TTL = 1000 * 60 * 10; // 10 minutes

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // DuckDuckGo Image Search Proxy Endpoint
  app.get("/api/search", async (req, res) => {
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
          // Direct DDG fetch - very fast timeout because it's often blocked on Vercel
          const ddgHtmlRes = await fetchWithTimeout(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&ia=web`, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "X-Forwarded-For": randIp,
              "True-Client-IP": randIp,
              "Accept-Language": "en-US,en;q=0.9"
            }
          }, 2500);
          html = await ddgHtmlRes.text();
        } catch (e) {}
        
        let vqdMatch = html.match(/vqd=['"]?([^&'"\s>]+)['"]?/);
        
        if (!vqdMatch) {
          try {
            // First proxy fallback
            const proxyRes = await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent('https://duckduckgo.com/?q=' + query)}`, {}, 5000);
            html = await proxyRes.text();
            vqdMatch = html.match(/vqd=['"]?([^&'"\s>]+)['"]?/);
          } catch(e) {}
        }

        if (vqdMatch && vqdMatch[1]) {
          vqd = vqdMatch[1];
          // Cache the found token
          vqdCache.set(query.trim().toLowerCase(), { token: vqd, expiry: Date.now() + VQD_TTL });
        } else {
          try {
            // Last resort proxy
            const fallbackRes = await fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent('https://duckduckgo.com/?q=' + query)}`, {}, 5000);
            html = await fallbackRes.text();
            vqdMatch = html.match(/vqd=['"]?([^&'"\s>]+)['"]?/);
            if (vqdMatch && vqdMatch[1]) {
              vqd = vqdMatch[1];
              vqdCache.set(query.trim().toLowerCase(), { token: vqd, expiry: Date.now() + VQD_TTL });
            }
          } catch (e) {}
        }
        
        if (!vqd) {
          throw new Error("Could not acquire search token from DuckDuckGo. (Vercel IP might be blocked)");
        }
      }

      // Step 2: Fetch Images
      // p=1 means Strict SafeSearch in DuckDuckGo
      const url = nextParam 
        ? `https://duckduckgo.com${nextParam.startsWith('/') ? nextParam : '/' + nextParam}&vqd=${vqd}`
        : `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`;

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

      if (!data) {
        throw new Error(`DuckDuckGo API responded with status: ${searchRes.status}`);
      }
      
      if (!data.results || data.results.length === 0) {
        return res.json({ results: [], vqd, next: null });
      }

      const mappedResults = data.results.map((item: any) => ({
        id: item.image,
        url: item.image,
        thumbnail: item.thumbnail,
        title: item.title,
        width: item.width,
        height: item.height
      }));

      res.json({
        results: mappedResults,
        vqd: vqd,
        next: data.next
      });

    } catch (error: any) {
      console.error("Search API Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch images" });
    }
  });

  // Image Proxy Endpoint (to bypass CORS when downloading)
  app.get("/api/proxy-image", async (req, res) => {
    const imageUrl = req.query.url as string;
    const filename = req.query.filename as string;
    if (!imageUrl) {
      return res.status(400).send("URL is required");
    }

    try {
      const urlObj = new URL(imageUrl);
      
    const tryFetch = async (customHeaders: any) => {
      return await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Referer": "https://duckduckgo.com/",
          ...customHeaders
        }
      });
    };

    let imageResponse: Response | null = null;
    try {
      // Primary: DDG referer
      imageResponse = await tryFetch({ "Referer": "https://duckduckgo.com/" });
      
      if (!imageResponse.ok) {
         // Secondary: Direct
         imageResponse = await tryFetch({});
      }
      
      if (!imageResponse.ok) {
         // Tertiary: Origin referer
         imageResponse = await tryFetch({ "Referer": urlObj.origin + "/" });
      }
    } catch (e) {
      console.error("Image proxy fetch error:", e);
    }

    if (!imageResponse || !imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse ? imageResponse.status : 'Network Error'}`);
    }

      const contentType = imageResponse.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }

      if (filename) {
        // Force the browser to trigger a native download with the specified filename
        res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/"/g, '')}"`);
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (error) {
      console.error("Image Proxy Error:", error);
      res.status(500).send("Failed to proxy image");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
