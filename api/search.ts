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
  const vqdParam = req.query.vqd;
  const nextParam = req.query.next;

  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required" });
  }

  const PROXIES = [
    (url: string) => url, // Try direct first
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];

  try {
    let success = false;
    let lastError = "";
    let finalResults: any[] = [];
    let finalNext = "";
    let finalVqd = vqdParam || "";

    for (const proxyGen of PROXIES) {
      try {
        let vqd = finalVqd;
        let cookies = "";

        if (!vqd) {
          const vqdUrl = proxyGen(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&ia=web`);
          const vqdResponse = await fetchWithTimeout(vqdUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5"
            }
          }, 8000);
          
          if (!vqdResponse.ok) {
            lastError = `Failed to fetch VQD: ${vqdResponse.status}`;
            continue;
          }

          const setCookieHeader = vqdResponse.headers.get('set-cookie');
          cookies = setCookieHeader ? setCookieHeader.split(',').map(c => c.split(';')[0]).join('; ') : '';

          const html = await vqdResponse.text();
          const vqdMatch = html.match(/vqd=['"]?([^&'"\s]+)['"]?/);
          vqd = vqdMatch ? vqdMatch[1] : '';

          if (!vqd) {
            lastError = "Could not extract VQD token.";
            continue;
          }
          finalVqd = vqd;
        }

        let targetUrl = nextParam 
          ? `https://duckduckgo.com${nextParam.startsWith('/') ? nextParam : `/${nextParam}`}`
          : `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`;

        const imgUrl = proxyGen(targetUrl);
        const imgResponse = await fetchWithTimeout(imgUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Referer": "https://duckduckgo.com/",
            "Cookie": cookies
          }
        }, 8000);

        if (!imgResponse.ok) {
          lastError = `Image fetch failed with status: ${imgResponse.status}`;
          continue;
        }

        const data = await imgResponse.json();
        if (data.results && data.results.length > 0) {
          finalResults = data.results;
        }

        finalNext = data.next || "";
        success = true;
        break;

      } catch (e: any) {
        lastError = e.message || "Network error";
        continue;
      }
    }

    if (!success) {
      throw new Error(lastError || "Failed to fetch images from all sources.");
    }

    const mappedResults = finalResults.map((r: any) => ({
      id: r.image, url: r.image, thumbnail: r.thumbnail, title: r.title, width: r.width, height: r.height
    }));

    res.json({ 
      results: mappedResults,
      vqd: finalVqd,
      next: finalNext
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch images" });
  }
}
