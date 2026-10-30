// Draws every city's preview, the picture its card on the landing page shows, in each theme: the
// basemap with its track over it, as WebP beside the dataset (cities/<country>/<city>/<city>.dark.webp);
// and its social card, the picture a link to its page shows (<city>.social.jpg, 1200 × 630).
//
//   pnpm data:previews            every city
//   pnpm data:previews london     one
//
// Needs Chrome installed, and the network for the basemap's tiles. Run it after a change to a city's
// track or lines' colours; the pictures are committed, as the datasets are.
import { parseNetwork } from '@railtime/schema/network.schema';
import { readFileSync, writeFileSync } from 'node:fs';
import { datasets } from './dataset/city.utils.ts';
import { PREVIEW_SIZE, PREVIEW_THEMES, SOCIAL_SIZE, SOCIAL_THEME } from './preview/preview.constants.ts';
import { previewPathOf, previewRequestOf, socialPathOf } from './preview/preview.utils.ts';
import { PreviewRenderer } from './preview/previewRenderer.service.ts';

const only = process.argv[2];
const chosen = datasets().filter(dataset => !only || dataset.city === only);
if (chosen.length === 0) {
  console.error(`usage: pnpm data:previews [city], where cities/<country>/<city>/<city>.json exists`);
  process.exit(1);
}

const renderer = new PreviewRenderer();
await renderer.start();
try {
  for (const { city, path } of chosen) {
    const network = parseNetwork(JSON.parse(readFileSync(path, 'utf8')));
    for (const theme of PREVIEW_THEMES) {
      const request = previewRequestOf(network, theme, PREVIEW_SIZE);
      if (!request) continue;
      const picture = await renderer.render(theme, request);
      writeFileSync(previewPathOf(path, theme), picture);
      console.log(`${city} ${theme}: ${Math.round(picture.length / 1024)} KB`);
    }
    const social = previewRequestOf(network, SOCIAL_THEME, SOCIAL_SIZE);
    if (!social) continue;
    const card = await renderer.render(SOCIAL_THEME, { ...social, format: 'image/jpeg' });
    writeFileSync(socialPathOf(path), card);
    console.log(`${city} social: ${Math.round(card.length / 1024)} KB`);
  }
} finally {
  await renderer.close();
}
