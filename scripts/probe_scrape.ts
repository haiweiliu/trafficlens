import { scrapeTrafficData } from '../lib/scraper';

async function main() {
  const domains = process.argv.slice(2).length ? process.argv.slice(2) : ['threads.com'];
  const results = await scrapeTrafficData(domains, false);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
