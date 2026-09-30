import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';

test('power dynamics security headers protect HTML and the scientific worker', async ({
  request,
  page,
}) => {
  const response = await request.get('./');
  const headers = response.headers();
  expect(headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains; preload');
  expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  const permissions = headers['permissions-policy'].split(',').map((value) => value.trim());
  // A local security proxy may add further denials; these required denials
  // must still be present exactly, without depending on header ordering.
  for (const feature of ['camera', 'microphone', 'geolocation'])
    expect(permissions.filter((value) => value.startsWith(`${feature}=`))).toEqual([
      `${feature}=()`,
    ]);
  const csp = headers['content-security-policy'];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain('cdn.jsdelivr.net');
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  const html = await response.text();
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))
    expect(csp).toContain(`'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
  const violations: string[] = [];
  page.on('console', (message) => {
    if (
      /violat.*content security policy|refused to.*(script|connect|worker|wasm)/i.test(
        message.text(),
      )
    )
      violations.push(message.text());
  });
  await page.goto('./?study=load-step');
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Power dynamics research studio' })).toBeVisible();
  await page.getByRole('button', { name: 'Run load step', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Study output' })).toBeVisible();
  const landmarks = await new AxeBuilder({ page })
    .withRules(['landmark-one-main', 'landmark-main-is-top-level'])
    .analyze();
  expect(landmarks.violations).toEqual([]);
  expect(violations).toEqual([]);
});
