import fs from 'fs';

async function testBing() {
    try {
        const query = 'naruto uzumaki';
        const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&first=1&count=50`;
        const bingRes = await fetch(bingUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          }
        });
        const html = await bingRes.text();
        fs.writeFileSync('bing.html', html);
        
        // Find all JSON objects within murl logic or other attributes
        const regexUrls = /https?:\/\/[a-zA-Z0-9.\/_:-]+(?:\.jpg|\.png|\.webp|\.jpeg)/gi;
        const matches = Array.from(new Set(html.match(regexUrls) || []));
        console.log("Total unique JPG/PNG URLs matching regex:", matches.length);
        console.log("Sample:", matches.slice(0, 5));

        const dataIus = html.match(/murl&quot;:&quot;(.*?)&quot;/g);
        console.log("MURL matches via entity:", dataIus?.length || 0);
        
        const dataIus2 = html.match(/"murl":"(.*?)"/g);
        console.log("MURL matches via quote:", dataIus2?.length || 0);

        const mediaurlRegex = /mediaurl=(.*?)(?:&amp;|&)/g;
        const mediaurls = [];
        let m;
        while ((m = mediaurlRegex.exec(html)) !== null) {
            mediaurls.push(decodeURIComponent(m[1]));
        }
        console.log("Mediaurl matches:", mediaurls.length);
    } catch(e) {
        console.error(e);
    }
}
testBing();
