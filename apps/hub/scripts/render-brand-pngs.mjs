import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// __dirname is d:/Work/task-hub/apps/hub/scripts
const hubDir = path.resolve(__dirname, '..');
const desktopDir = path.resolve(__dirname, '../../desktop');
const rootDir = path.resolve(__dirname, '../../..');

const hubBrandDir = path.join(hubDir, 'public/brand');
const desktopPublicDir = path.join(desktopDir, 'public');

function renderSvgToPng(svgPath, pngPath, width, height) {
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  const opts = {
    fitTo: {
      mode: 'width',
      value: width,
    },
    background: 'rgba(0, 0, 0, 0)',
  };
  const resvg = new Resvg(svgContent, opts);
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  fs.writeFileSync(pngPath, pngBuffer);
  console.log(`Rendered: ${pngPath} (${width}x${height || width})`);
}

// 1. App Icon 512x512
const hubMarkSvg = path.join(hubBrandDir, 'midnight-hub-mark.svg');
renderSvgToPng(hubMarkSvg, path.join(desktopPublicDir, 'icon.png'), 512, 512);
renderSvgToPng(hubMarkSvg, path.join(desktopPublicDir, 'midnight-hub-mark.png'), 512, 512);
renderSvgToPng(hubMarkSvg, path.join(hubBrandDir, 'midnight-hub-mark.png'), 512, 512);

// 2. Tray Icon 32x32
const traySvg = path.join(desktopPublicDir, 'midnight-hub-tray.svg');
renderSvgToPng(traySvg, path.join(desktopPublicDir, 'tray-icon.png'), 32, 32);
renderSvgToPng(traySvg, path.join(desktopPublicDir, 'midnight-hub-tray.png'), 32, 32);

// 3. Horizontal Logo 640x140
const horizontalSvg = path.join(hubBrandDir, 'midnight-hub-logo-horizontal.svg');
renderSvgToPng(horizontalSvg, path.join(hubBrandDir, 'midnight-hub-logo-horizontal.png'), 640, 140);

console.log('All brand PNG assets generated successfully!');
