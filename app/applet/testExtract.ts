import fetch from "node-fetch";

async function testBing() {
    try {
        const query = 'naruto uzumaki';
        const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&count=50`;
        const bingRes = await fetch(bingUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Cookie": "SRCHHPGUSR=ADLT=OFF&NRSLT=50;"
          }
        });
        const html = await bingRes.text();
        
        let results = [];
        
        // 1. Try finding murl in standard json-like structures
        const murlRegex = /"murl":"([^"]+)"/g;
        let match;
        while ((match = murlRegex.exec(html)) !== null) {
            results.push(match[1]);
        }

        // 2. Try HTML entity encoded murls
        const encodedMurlRegex = /murl&quot;:&quot;(.*?)&quot;/g;
        while ((match = encodedMurlRegex.exec(html)) !== null) {
            results.push(match[1]);
        }

        // 3. Fallback: get any high-res image url ending in jpg/png/webp if we don't have enough
        if (results.length < 10) {
            const generalRegex = /https?:\/\/[^"'\s<>]+?\.(?:jpg|jpeg|png|webp)/gi;
            const generalMatches = html.match(generalRegex) || [];
            results.push(...generalMatches);
        }

        console.log("Total extracted:", results.length);
        console.log("Samples:", results.slice(0, 10));

    } catch(e) {
        console.error(e);
    }
}
testBing();
