import { SUBGRAPHS } from "../src/config.js";
import { resolveUrl, fetchSubgraph } from "../src/graph.js";

console.log("🏥 Checking health of all configured subgraphs...\n");

async function checkSubgraph(sg) {
  const url = resolveUrl(sg);
  if (!url) {
    return { name: sg.name, status: "❌", error: "Could not resolve URL" };
  }

  // Use the specific query for the subgraph to ensure it's valid
  const result = await fetchSubgraph(url, sg.query);

  if (result.error) {
    return { name: sg.name, status: "❌", error: result.error, url };
  }
  
  return { name: sg.name, status: "✅", url };
}

async function run() {
  const results = await Promise.all(SUBGRAPHS.map(checkSubgraph));

  for (const r of results) {
    console.log(`${r.status} [${r.name}]`);
    if (r.status === "❌") {
      console.log(`   Error: ${r.error}`);
    }
    // console.log(`   URL: ${r.url}`); 
  }
}

run();
