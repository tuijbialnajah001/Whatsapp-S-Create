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

