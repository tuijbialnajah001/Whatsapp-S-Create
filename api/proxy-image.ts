export default async function handler(req: any, res: any) {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send("URL is required");
  }

  try {
    const imageResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://duckduckgo.com/"
      }
    });

    if (!imageResponse.ok) throw new Error(`Failed to fetch image: ${imageResponse.status}`);

    const contentType = imageResponse.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    res.status(500).send("Failed to proxy image");
  }
}
