import { describe, expect, it, mock } from 'bun:test';
import { createScreenLoader } from '../../src/client/screen-loader.js';

describe('createScreenLoader', () => {
  it('fetches and caches a screen', async () => {
    const mockScreen = { spec: { root: 'page', elements: {} } };
    const fetchFn = mock().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockScreen),
    });

    const loader = createScreenLoader(fetchFn as unknown as typeof fetch);
    const screen = await loader.loadScreen('home');
    expect(screen).toEqual(mockScreen);
    expect(fetchFn).toHaveBeenCalledWith('/_screens/home.json');

    // Second call should use cache
    const cached = await loader.loadScreen('home');
    expect(cached).toEqual(mockScreen);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('fetches and caches a layout', async () => {
    const mockLayout = { spec: { root: 'shell', elements: {} } };
    const fetchFn = mock().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLayout),
    });

    const loader = createScreenLoader(fetchFn as unknown as typeof fetch);
    const layout = await loader.loadLayout('main');
    expect(layout).toEqual(mockLayout);
    expect(fetchFn).toHaveBeenCalledWith('/_layouts/main.json');
  });

  it('throws on non-ok response', async () => {
    const fetchFn = mock().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const loader = createScreenLoader(fetchFn as unknown as typeof fetch);
    await expect(loader.loadScreen('missing')).rejects.toThrow('Failed to load /_screens/missing.json: 404');
  });
});
