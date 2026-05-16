import fetch from "node-fetch";

const q = 'naruto uzumaki';
async function test() {
    try {
        const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }
        });
        const tokenHtml = await tokenRes.text();
        const vqdMatch = tokenHtml.match(/vqd=(["']?)(.*?)\1/);
        const vqdMatch2 = tokenHtml.match(/vqd["']?:\s*["']([^"']+)["']/);
        
        let vqd = null;
        if (vqdMatch && vqdMatch[2]) vqd = vqdMatch[2];
        else if (vqdMatch2 && vqdMatch2[1]) vqd = vqdMatch2[1];

        console.log("Got VQD:", vqd);

        const searchUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(q)}&o=json&p=1&vqd=${vqd}&f=,,,&l=us-en`;
        const searchRes = await fetch(searchUrl, {
          headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Referer": "https://duckduckgo.com/"
          }
        });
        const text = await searchRes.text();
        console.log("Search response:", text.substring(0, 150));
    } catch(e) {
        console.error(e);
    }
}
test();
