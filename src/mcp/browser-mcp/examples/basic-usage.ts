/**
 * Basic usage examples for Trench Archival Browser
 */

import { Archiver, ArchiveAnalyzer, ArchiveReplay } from '../src/index.js';

// Example: Simple archive with progress
async function simpleArchive() {
  console.log('Creating simple archive...');
  
  const archiver = new Archiver({
    url: 'https://example.com',
    outputDir: './archive_example',
    fullAssets: true,
    maxDepth: 1,
    maxPages: 5
  }, (event) => {
    console.log(`[${event.type}] ${event.current}/${event.total}: ${event.message || event.url}`);
  });
  
  await archiver.initialize();
  const result = await archiver.archive();
  
  console.log('Archive complete!');
  console.log(`  Pages: ${result.stats.totalPages}`);
  console.log(`  Assets: ${result.stats.totalAssets}`);
  console.log(`  Size: ${result.stats.totalSize} bytes`);
  
  return result;
}

// Run example
simpleArchive().catch(console.error);
