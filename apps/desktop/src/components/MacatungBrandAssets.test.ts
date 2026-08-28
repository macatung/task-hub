import { describe, expect, it } from 'vitest';
import logo from '../../public/macatung-mark.svg?raw';
import tray from '../../public/macatung-tray.svg?raw';
import midnightMark from '../../public/midnight-hub-mark.svg?raw';
import midnightTray from '../../public/midnight-hub-tray.svg?raw';
import mainSource from '../../electron/main.ts?raw';

describe('Midnight Hub & Macatung brand assets', () => {
  it('ships the luminous Midnight Crescent M mark and dedicated tray mark', () => {
    expect(midnightMark).toContain('#00F5A0');
    expect(midnightMark).toContain('viewBox="0 0 512 512"');
    expect(midnightTray).toContain('viewBox="0 0 32 32"');
    expect(midnightTray).toContain('#00F5A0');
  });

  it('ships a monochrome line-art logo and tray mark for legacy fallback', () => {
    expect(logo).toContain('stroke="#F4F4F5"');
    expect(logo).toContain('stroke-linecap="round"');
    expect(tray).toContain('One-colour variant');
  });

  it('loads the dedicated tray asset before falling back to the app mark', () => {
    expect(mainSource).toContain('function getTrayImage()');
    expect(mainSource).toContain('midnight-hub-tray.svg');
    expect(mainSource).toContain('macatung-tray.svg');
    expect(mainSource).toContain("process.env.VITE_PUBLIC || ''");
    expect(mainSource).toContain('new Tray(getTrayImage())');
  });
});
