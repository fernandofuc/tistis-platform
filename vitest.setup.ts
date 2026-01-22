/**
 * TIS TIS Platform - Vitest Setup
 *
 * Configuration for Vitest tests including React component tests with jsdom.
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// TextEncoder/TextDecoder for LangChain/LangGraph
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// ReadableStream polyfill for LangChain
import { ReadableStream, TransformStream, WritableStream } from 'stream/web';
global.ReadableStream = ReadableStream as typeof global.ReadableStream;
global.TransformStream = TransformStream as typeof global.TransformStream;
global.WritableStream = WritableStream as typeof global.WritableStream;

// Fetch polyfill for Node < 18 (if needed)
if (!global.fetch) {
  global.fetch = vi.fn() as typeof global.fetch;
  global.Headers = vi.fn() as unknown as typeof global.Headers;
  global.Request = vi.fn() as unknown as typeof global.Request;
  global.Response = vi.fn() as unknown as typeof global.Response;
}

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    };
  },
  usePathname() {
    return '/';
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Only apply browser mocks when running in jsdom environment
if (typeof window !== 'undefined') {
  // Mock matchMedia for responsive tests
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock ResizeObserver
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

  // Mock IntersectionObserver
  class IntersectionObserverMock {
    constructor() {}
    observe() { return null; }
    unobserve() { return null; }
    disconnect() { return null; }
  }
  window.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;
}
