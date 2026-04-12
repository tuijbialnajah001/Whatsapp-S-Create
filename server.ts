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
    const nextParam = req.query.next as string;

    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const offset = parseInt(nextParam) || 1;
    let results: any[] = [];
    let nextOffset = offset + 50;

    try {
      // Try Bing Image Search First (Very reliable for serverless/Vercel)
      try {
        const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=${offset}&count=50`;
        const bingRes = await fetchWithTimeout(bingUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          }
        }, 8000);

        if (bingRes.ok) {
          const html = await bingRes.text();
          const decodedHtml = html.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
          
          const murlRegex = /"murl":"([^"]+)"/g;
          const turlRegex = /"turl":"([^"]+)"/g;
          
          let murls = [];
          let match;
          while ((match = murlRegex.exec(decodedHtml)) !== null) {
            murls.push(match[1]);
          }
          
          let turls = [];
          while ((match = turlRegex.exec(decodedHtml)) !== null) {
            turls.push(match[1]);
          }
          
          for (let i = 0; i < murls.length; i++) {
            results.push({
              id: murls[i],
              url: murls[i],
              thumbnail: turls[i] || murls[i],
              title: query,
              width: 800,
              height: 600
            });
          }
        }
      } catch (e) {
        console.error("Bing search failed:", e);
      }

      // If Bing fails or returns no results, try Yahoo Image Search
      if (results.length === 0) {
        try {
          const yahooUrl = `https://images.search.yahoo.com/search/images?p=${encodeURIComponent(query)}&b=${offset}`;
          const yahooRes = await fetchWithTimeout(yahooUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }
          }, 8000);

          if (yahooRes.ok) {
            const html = await yahooRes.text();
            const decodedHtml = html.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
            
            const iurlRegex = /"iurl":"([^"]+)"/g;
            const ithRegex = /"ith":"([^"]+)"/g;
            
            let iurls = [];
            let match;
            while ((match = iurlRegex.exec(decodedHtml)) !== null) {
              iurls.push(match[1]);
            }
            
            let iths = [];
            while ((match = ithRegex.exec(decodedHtml)) !== null) {
              iths.push(match[1]);
            }
            
            for (let i = 0; i < iurls.length; i++) {
              results.push({
                id: iurls[i],
                url: iurls[i],
                thumbnail: iths[i] || iurls[i],
                title: query,
                width: 800,
                height: 600
              });
            }
          }
        } catch (e) {
          console.error("Yahoo search failed:", e);
        }
      }

      if (results.length === 0) {
        throw new Error("Failed to fetch images from search engines. They might be blocking the server IP.");
      }

      // Remove duplicates
      const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());

      res.json({ 
        results: uniqueResults,
        vqd: "", // Not needed anymore
        next: nextOffset.toString()
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
            "Accept-Language": "en-US,en;q=0.9",
            "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "image",
            "sec-fetch-mode": "no-cors",
            "sec-fetch-site": "cross-site",
            ...customHeaders
          }
        });
      };

      // Strategy 1: Same origin referer
      let imageResponse: Response | null = null;
      try {
        imageResponse = await tryFetch({ "Referer": urlObj.origin + "/" });
      } catch (e) {
        // Ignore
      }

      // Strategy 2: No referer
      if (!imageResponse || (!imageResponse.ok && [403, 401, 522, 503, 500].includes(imageResponse.status))) {
        try {
          imageResponse = await tryFetch({});
        } catch (e) {
          // Ignore
        }
      }

      // Strategy 3: Google referer
      if (!imageResponse || (!imageResponse.ok && [403, 401, 522, 503, 500].includes(imageResponse.status))) {
        try {
          imageResponse = await tryFetch({ "Referer": "https://www.google.com/" });
        } catch (e) {
          // Ignore
        }
      }

      // Strategy 4: Bing referer
      if (!imageResponse || (!imageResponse.ok && [403, 401, 522, 503, 500].includes(imageResponse.status))) {
        try {
          imageResponse = await tryFetch({ "Referer": "https://www.bing.com/" });
        } catch (e) {
          // Ignore fetch errors to try next strategy
        }
      }

      // Strategy 5: Google Image Proxy (Ultimate Fallback)
      if (!imageResponse || !imageResponse.ok) {
        try {
          const googleProxyUrl = `https://images1-focus-opensocial.googleusercontent.com/gadgets/proxy?container=focus&refresh=2592000&url=${encodeURIComponent(imageUrl)}`;
          imageResponse = await fetch(googleProxyUrl);
        } catch (e) {
          // Ignore
        }
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
