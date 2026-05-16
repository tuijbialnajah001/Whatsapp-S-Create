async function testDDGHTML() {
    try {
        const query = 'naruto uzumaki';
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}+images`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        const html = await res.text();
        console.log("length:", html.length);
        console.log("Snippet:", html.substring(0, 200).replace(/\n/g, ' '));
        
        // Find links that might be images
        const regexUrls = /https?:\/\/[a-zA-Z0-9.\/_:-]+(?:\.jpg|\.png|\.webp|\.jpeg)/gi;
        const matches = Array.from(new Set(html.match(regexUrls) || []));
        console.log("Total unique JPG/PNG URLs:", matches.length);
        console.log("Sample:", matches.slice(0, 5));
    } catch(e) {
        console.error(e);
    }
}
testDDGHTML();
