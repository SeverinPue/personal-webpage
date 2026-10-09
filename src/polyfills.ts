/**
 * This file includes polyfills needed by Angular and is loaded before the app.
 * You can add your own extra polyfills to this file.
 */

(window as any).global = window;
import { Buffer } from 'buffer';
(window as any).Buffer = (window as any).Buffer || Buffer;
(window as any).process = (window as any).process || {};
(window as any).process.env = (window as any).process.env || { DEBUG: undefined };
(window as any).process.nextTick = (window as any).process.nextTick || function (fn: any, ...args: any[]) {
  return queueMicrotask(() => fn(...args));
};

/***************************************************************************************************
 * Zone JS is required by default for Angular itself.
 */
import 'zone.js';  // Included with Angular CLI.
