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

export default async function handler(req: any, res: any) {
  const query = req.query.q;
  const nextParam = req.query.next;

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
    res.status(500).json({ error: error.message || "Failed to fetch images" });
  }
}
