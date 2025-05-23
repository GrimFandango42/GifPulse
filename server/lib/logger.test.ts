import { describe, it, expect, vi } from 'vitest';
import logger from './logger'; // Adjust path as necessary

// Mock pino and pino-pretty
vi.mock('pino', () => {
  const actualPino = vi.importActual('pino');
  const pinoInstance = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => pinoInstance), // Mock child to return the same instance
  };
  // Mock the default export as a function that returns the pinoInstance
  const pinoMock = vi.fn(() => pinoInstance);
  // Also attach any static properties or methods if needed, e.g., pino.destination
  Object.assign(pinoMock, actualPino);
  return { default: pinoMock };
});

vi.mock('pino-pretty', () => {
  // pino-pretty is usually a transport, its specifics might not be crucial for basic logger functionality tests
  return { default: vi.fn() };
});


describe('Logger', () => {
  it('should be created (imported successfully)', () => {
    expect(logger).toBeDefined();
  });

  it('should have common logging methods', () => {
    expect(logger.info).toBeInstanceOf(Function);
    expect(logger.error).toBeInstanceOf(Function);
    expect(logger.warn).toBeInstanceOf(Function);
    expect(logger.debug).toBeInstanceOf(Function);
  });

  it('should call the underlying pino info method', () => {
    logger.info('Test info message');
    // logger is the pinoInstance due to the mock structure
    expect(logger.info).toHaveBeenCalledWith('Test info message');
  });

  it('should call the underlying pino error method with an object', () => {
    const err = new Error('Test error');
    logger.error({ err, context: 'test' }, 'Test error message');
    expect(logger.error).toHaveBeenCalledWith({ err, context: 'test' }, 'Test error message');
  });
  
  // Note: Testing the actual output format (pretty print vs JSON) is more complex
  // as it depends on NODE_ENV and the transport. These tests focus on the logger instance.
});
