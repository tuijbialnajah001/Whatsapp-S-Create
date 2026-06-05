export default async function handler(req: any, res: any) {
  const imageUrl = req.query.url as string;
  const filename = req.query.filename as string;
  if (!imageUrl) {
    return res.status(400).send("URL is required");
  }

  try {
    const urlObj = new URL(imageUrl);
    
    let isBing = imageUrl.includes('bing.net') || imageUrl.includes('bing.com');
    let isYahoo = imageUrl.includes('yimg.com');
    // If it's Bing or Yahoo, duckduckgo referer might not be the best but it probably doesn't matter.
    // Wait, earlier the user said 'duckduckgo source hi hona chahiye aur sab hata do'
    
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

    // Strategy 1: duckduckgo external content proxy (simplest way to get around everything!)
    // wait, duckduckgo image api ALREADY provides thumbnails!
    
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

    // Strategy 3: DuckDuckGo referer
    if (!imageResponse || (!imageResponse.ok && [403, 401, 522, 503, 500].includes(imageResponse.status))) {
      try {
        imageResponse = await tryFetch({ "Referer": "https://duckduckgo.com/" });
      } catch (e) {
        // Ignore fetch errors to try next strategy
      }
    }

    if (!imageResponse || !imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse ? imageResponse.status : 'Network Error'}`);
    }

    const contentType = imageResponse.headers.get("content-type");
    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }
    
    // allow caching in browser!
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");

    if (filename) {
      // Force the browser to trigger a native download with the specified filename
      res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/"/g, '')}"`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    res.status(500).send("Failed to proxy image");
  }
}

