/**
 * TypeScript Mock Test Doubles for macatung.dev Test Infrastructure
 */

export * from './mock_helpers.js';

export interface IMockDOMEnvironment {
  window: any;
  document: any;
  audioContext: any;
  localStorage: any;
  sessionStorage: any;
  inertiaRouter: any;
  confetti: any;
  teardown: () => void;
}

export interface ICanvasCall {
  method: string;
  args: any[];
  state: {
    fillStyle: string;
    strokeStyle: string;
    globalAlpha: number;
    lineWidth: number;
    font: string;
  };
}

export interface IAudioEvent {
  type: string;
  value?: number;
  target?: number;
  time: number;
  endTime?: number;
  timeConstant?: number;
  duration?: number;
  values?: number[];
}
