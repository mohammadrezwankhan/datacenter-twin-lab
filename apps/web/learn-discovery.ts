// This page reveals reviewed HTML only; numerical engines are separate, explicit links.
const form = document.querySelector<HTMLFormElement>('.learn-search');
const search = document.querySelector<HTMLInputElement>('#learning-search');
const cards = [...document.querySelectorAll<HTMLElement>('[data-learning-id]')];
const filters = [...document.querySelectorAll<HTMLButtonElement>('[data-filter]')];
const count = document.querySelector<HTMLElement>('#learning-count');
const empty = document.querySelector<HTMLElement>('.learn-empty');
const kinds = new Set(['all', 'continuity', 'emt', 'dynamics']);
let path = 'all';

function render(): void {
  if (!search) return;
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let visible = 0;
  for (const card of cards) {
    const matches =
      (path === 'all' || card.dataset.kind === path) &&
      terms.every((term) => (card.dataset.search || '').includes(term));
    card.hidden = !matches;
    if (matches) visible += 1;
  }
  for (const group of document.querySelectorAll<HTMLElement>('.learning-group'))
    group.hidden = !group.querySelector('[data-learning-id]:not([hidden])');
  for (const button of filters)
    button.setAttribute('aria-pressed', String(button.dataset.filter === path));
  if (count) count.textContent = `${visible} of ${cards.length} learning items shown`;
  if (empty) empty.hidden = visible !== 0;
}

function save(push = false): void {
  const url = new URL(location.href);
  const query = search?.value.trim() || '';
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  if (path === 'all') url.searchParams.delete('path');
  else url.searchParams.set('path', path);
  history[push ? 'pushState' : 'replaceState'](null, '', url);
  render();
}

function restore(): void {
  const params = new URL(location.href).searchParams;
  const requested = params.get('path') || 'all';
  path = kinds.has(requested) ? requested : 'all';
  if (search) search.value = (params.get('q') || '').slice(0, 200);
  render();
}

if (form && search) {
  form.hidden = false;
  restore();
  search.addEventListener('input', () => save());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    save(true);
  });
  form.addEventListener('reset', (event) => {
    event.preventDefault();
    search.value = '';
    path = 'all';
    save(true);
  });
  for (const button of filters)
    button.addEventListener('click', () => {
      path = button.dataset.filter || 'all';
      save(true);
    });
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-path]')) {
    link.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      path = link.dataset.path || 'all';
      search.value = '';
      save(true);
      search.focus({ preventScroll: true });
      form.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
  addEventListener('popstate', restore);
}

const picker = document.querySelector<HTMLSelectElement>('#diagram-model');
const diagrams = [...document.querySelectorAll<HTMLElement>('[data-model]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
const motionAllowed = () => !reducedMotion.matches && !connection?.saveData;

function stop(diagram: HTMLElement): void {
  diagram.classList.remove('flow-playing', 'flow-paused');
  const pause = diagram.querySelector<HTMLButtonElement>('[data-flow="pause"]')!;
  pause.disabled = true;
  pause.textContent = 'Pause flow';
  diagram.querySelector<HTMLElement>('.flow-status')!.textContent = motionAllowed()
    ? 'Static diagram. No simulation is running.'
    : 'Static view: reduced motion or data saving is enabled.';
}

for (const diagram of diagrams) {
  const controls = diagram.querySelector<HTMLElement>('.diagram-controls')!;
  const stage = diagram.querySelector<HTMLElement>('.diagram-stage')!;
  const replay = diagram.querySelector<HTMLButtonElement>('[data-flow="replay"]')!;
  const pause = diagram.querySelector<HTMLButtonElement>('[data-flow="pause"]')!;
  const status = diagram.querySelector<HTMLElement>('.flow-status')!;
  controls.hidden = false;
  const reduce = () => {
    stop(diagram);
    replay.disabled = !motionAllowed();
    stage.classList.toggle('static-view', !motionAllowed());
    diagram.querySelector<HTMLButtonElement>('[data-view="rotate"]')!.disabled = !motionAllowed();
  };
  reduce();
  reducedMotion.addEventListener('change', reduce);
  diagram
    .querySelector('[data-view="rotate"]')!
    .addEventListener('click', () => stage.classList.toggle('is-rotated'));
  diagram.querySelector('[data-view="reset"]')!.addEventListener('click', () => {
    stage.classList.remove('is-rotated');
    stop(diagram);
  });
  replay.addEventListener('click', () => {
    if (!motionAllowed()) return;
    stop(diagram);
    // Restart the short illustration on an explicit replay, including after a completed run.
    void stage.offsetWidth;
    diagram.classList.add('flow-playing');
    pause.disabled = false;
    status.textContent = 'Illustrative flow playing once. No solver inputs or results change.';
  });
  pause.addEventListener('click', () => {
    const paused = diagram.classList.toggle('flow-paused');
    pause.textContent = paused ? 'Resume flow' : 'Pause flow';
    status.textContent = paused
      ? 'Illustration paused. No simulation is running.'
      : 'Illustrative flow resumed.';
  });
  stage.addEventListener('animationend', () => stop(diagram));
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) stop(diagram);
  }).observe(diagram);
}

if (picker) {
  picker.parentElement!.hidden = false;
  const choose = () => {
    for (const diagram of diagrams) {
      stop(diagram);
      diagram.hidden = diagram.dataset.model !== picker.value;
    }
  };
  choose();
  picker.addEventListener('change', choose);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) diagrams.forEach(stop);
});
export {};
