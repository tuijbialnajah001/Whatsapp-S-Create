import fetch from "node-fetch";
async function testAPI() {
    try {
        const res = await fetch("http://localhost:3000/api/search?q=goku");
        const data = await res.json();
        console.log("Total:", data.results?.length);
        console.log("Samples:", data.results?.slice(0, 5).map(r => r.url));
    } catch(e) {
        console.error(e);
    }
}
testAPI();
