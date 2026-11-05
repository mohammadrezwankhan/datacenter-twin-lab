import assert from 'node:assert/strict';
import test from 'node:test';
import { pageForSearch, urlForPage } from '../src/workspace-navigation.ts';
import type { Page } from '../src/workspace-navigation.ts';

for (const page of [
  'start',
  'overview',
  'topology',
  'evidence',
  'learn',
  'energy',
  'assurance',
  'emt',
  'studies',
] as Page[]) {
  void test(`workspace URL restores ${page} and clears a previous view's fragment`, () => {
    const url = urlForPage(
      'https://example.test/?study=modal&lesson=ride-through&mode=advanced&view=energy#guided-output',
      page,
    );
    assert.equal(url.hash, '');
    assert.equal(pageForSearch(url.search, true), page);
  });
}
void test('old advanced links and unknown subviews still open the overview', () => {
  assert.equal(pageForSearch('?mode=advanced', true), 'overview');
  assert.equal(pageForSearch('?mode=advanced&view=missing', true), 'overview');
});
void test('local workspace subviews restore without enabling the hosted studies', () => {
  assert.equal(pageForSearch('?mode=advanced&view=topology', false), 'topology');
  assert.equal(pageForSearch('?study=modal', false), 'overview');
});

void test('the local research-evidence view survives history restoration', () => {
  const url = urlForPage('https://example.test/?mode=advanced', 'assurance');
  assert.equal(pageForSearch(url.search, false), 'assurance');
});
