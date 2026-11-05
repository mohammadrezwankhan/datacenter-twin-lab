/** Lab measurements, not field Core Web Vitals or Lighthouse scores. */
import { expect, test } from '@playwright/test';

test('capture observable paint, shift, long-task and input timing for guide/course/advanced', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const observations: Record<string, unknown>[] = [];
  await page.addInitScript(() => {
    const result = {
      cls: 0,
      largestPaintMs: 0,
      fcpMs: 0,
      longTasks: [] as number[],
      eventDurations: [] as number[],
    };
    (window as Window & { __labVitals?: typeof result }).__labVitals = result;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput)
            result.cls += (entry as PerformanceEntry & { value?: number }).value ?? 0;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      /* metric unsupported in this browser */
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) result.largestPaintMs = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      /* metric unsupported */
    }
    try {
      new PerformanceObserver((list) => {
        result.longTasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      /* metric unsupported */
    }
    try {
      const eventOptions: PerformanceObserverInit & { durationThreshold: number } = {
        type: 'event',
        buffered: true,
        durationThreshold: 16,
      };
      new PerformanceObserver((list) => {
        result.eventDurations.push(...list.getEntries().map((entry) => entry.duration));
      }).observe(eventOptions);
    } catch {
      /* metric unsupported */
    }
  });
  for (const route of ['./', './?lesson=power-energy', './?mode=advanced']) {
    const start = Date.now();
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    if (route.includes('lesson=')) await expect(page.getByTestId('lesson-result')).toBeVisible();
    else if (route.includes('advanced'))
      await expect(page.getByTestId('served-power')).toBeVisible();
    else
      await expect(
        page.getByRole('heading', { name: /How long will the battery last\?/i }),
      ).toBeVisible();
    await page.waitForTimeout(750);
    const frameIntervalsMs = await page.evaluate(async () => {
      return new Promise<number[]>((resolve) => {
        const intervals: number[] = [];
        const started = performance.now();
        let previous = started;
        const tick = (now: number) => {
          intervals.push(now - previous);
          previous = now;
          if (now - started < 800) requestAnimationFrame(tick);
          else resolve(intervals.slice(1));
        };
        requestAnimationFrame(tick);
      });
    });
    const orderedIntervals = [...frameIntervalsMs].sort((a, b) => a - b);
    const frameP95Ms = orderedIntervals[Math.floor(orderedIntervals.length * 0.95)] ?? null;
    const metrics = await page.evaluate(() => {
      const state = (
        window as Window & {
          __labVitals?: {
            cls: number;
            largestPaintMs: number;
            fcpMs: number;
            longTasks: number[];
            eventDurations: number[];
          };
        }
      ).__labVitals;
      return {
        fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
        lcpCandidateMs: state?.largestPaintMs || null,
        clsObserved: state?.cls ?? null,
        longTaskTotalBlockingProxyMs:
          state?.longTasks.reduce((sum, ms) => sum + Math.max(0, ms - 50), 0) ?? null,
        eventDurationMaximumObservedMs: state?.eventDurations.length
          ? Math.max(...state.eventDurations)
          : null,
        navigationTTFBMs: performance.getEntriesByType('navigation')[0]
          ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)
              .responseStart
          : null,
      };
    });
    const observation = {
      route,
      measuredAt: new Date().toISOString(),
      readyWallTimeMs: Date.now() - start,
      frameP95Ms,
      ...metrics,
    };
    observations.push(observation);
    if (process.env.AUDIT_PERF_ENFORCE === '1') {
      // Reproducible lab budget checks. Field INP and Lighthouse 100 are *not* established here.
      expect(observation.fcpMs).not.toBeNull();
      expect(observation.lcpCandidateMs).not.toBeNull();
      expect(Number(observation.fcpMs)).toBeLessThan(600);
      expect(Number(observation.lcpCandidateMs)).toBeLessThan(1000);
      expect(Number(observation.clsObserved)).toBe(0);
      expect(Number(observation.longTaskTotalBlockingProxyMs)).toBe(0);
    }
  }
  await testInfo.attach('performance-observations', {
    body: JSON.stringify(
      {
        environment: 'Vite preview in Playwright Chromium, no network/CPU throttling',
        limitations:
          'Frame p95 is an rAF scheduling sample, not validated rendered FPS; LCP is a lab candidate; event duration is not field p75 INP; longtask proxy is not official Lighthouse TBT.',
        observations,
        errors,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect(errors).toEqual([]);
});
