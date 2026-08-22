import { describe, expect, it } from 'vitest';
import logo from '../../public/macatung-mark.svg?raw';
import tray from '../../public/macatung-tray.svg?raw';
import mainSource from '../../electron/main.ts?raw';

describe('Macatung brand assets', () => {
  it('ships a monochrome line-art logo and tray mark', () => {
    expect(logo).toContain('stroke="#F4F4F5"');
    expect(logo).toContain('stroke-linecap="round"');
    expect(tray).toContain('One-colour variant');
  });

  it('loads the dedicated tray asset before falling back to the app mark', () => {
    expect(mainSource).toContain('function getTrayImage()');
    expect(mainSource).toContain('macatung-tray.svg');
    expect(mainSource).toContain("process.env.VITE_PUBLIC || ''");
    expect(mainSource).toContain('new Tray(getTrayImage())');
  });
});
