import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { lessons, lessonScenario, type Lesson } from './src/course-lessons.ts';
import { ENGINE_VERSION } from './src/js-engine/version.ts';
import type { SiteScenario } from './src/types.ts';
import site from './site.config.json' with { type: 'json' };

const repository = 'https://github.com/mohammadrezwankhan/datacenter-twin-lab';
const title = 'Datacenter Power Systems: Free Interactive Course | Datacenter Twin Lab';
const description =
  'Learn datacenter power continuity with 12 free browser lessons. Predict battery ride-through, test generator failures, and reproduce the energy balance in Python.';
const courseName = 'Power Systems for Datacenter Engineers';
const escape = (value: unknown) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const json = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c');

export function publicSiteUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('The public site URL must be HTTPS without credentials, query or fragment.');
  return url.href.replace(/\/?$/, '/');
}

const style = `
:root{color-scheme:light;--ink:#173041;--muted:#425c6b;--teal:#09685e;--paper:#f6f9f8;--line:#cadbd7}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.7 system-ui,sans-serif}
a{color:#005d82;text-underline-offset:.2em}a:hover{color:#00364c}a:focus-visible{outline:3px solid #a44806;outline-offset:4px}
.skip{position:absolute;left:1rem;top:-5rem;background:white;padding:.5rem}.skip:focus{top:1rem}
header,main,footer{max-width:1120px;margin:auto;padding:1.5rem 2rem}header{display:flex;gap:1.5rem;justify-content:space-between;flex-wrap:wrap;border-bottom:1px solid var(--line)}
header>a{font-weight:800;letter-spacing:.06em;text-decoration:none;color:var(--ink)}nav{display:flex;gap:1.25rem;flex-wrap:wrap}
main{padding-top:3rem;padding-bottom:4rem}h1{font-size:clamp(2.1rem,5vw,3.7rem);line-height:1.1;letter-spacing:-.045em;max-width:900px;margin:.7rem 0 1.5rem}h2{font-size:1.5rem;line-height:1.3;margin:2.3rem 0 1rem}h3{line-height:1.4}
p{max-width:80ch}.eyebrow{font-weight:750;font-size:.78rem;letter-spacing:.16em;color:var(--teal);text-transform:uppercase}.lead{font-size:1.22rem;color:var(--muted);max-width:65ch}
.button{display:inline-block;padding:.8rem 1.3rem;background:#0b655d;border-radius:.45rem;color:white;text-decoration:none;font-weight:700}.button:hover{background:#064c46;color:white}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:1rem;margin-top:2rem}.card,.panel{background:white;border:1px solid var(--line);border-radius:.8rem;padding:1.5rem}.card{border-top:4px solid var(--teal)}.card:nth-child(3n+2){border-top-color:#236fb0}.card:nth-child(3n){border-top-color:#a95e12}.card h2{font-size:1.18rem;margin:.5rem 0}.card p{font-size:.94rem}.panel{margin:1.5rem 0}
.answer{border-left:5px solid var(--teal);background:#e7f3ee}.answer h2{margin-top:0}.equation{font:600 1rem/1.8 ui-monospace,monospace;overflow-wrap:anywhere}.tags{display:flex;gap:.65rem;flex-wrap:wrap}.tags span{border:1px solid var(--line);border-radius:2rem;padding:.2rem .8rem;font-size:.85rem}
table{width:100%;border-collapse:collapse;background:white;font-size:.94rem}caption{text-align:left;font-weight:700;padding:.7rem 0}th,td{text-align:left;vertical-align:top;padding:.65rem .8rem;border-bottom:1px solid var(--line);overflow-wrap:anywhere}th{font-weight:650}thead{background:#e7f0ee}.table-wrap{overflow-x:auto}
figure{margin:2rem 0}svg{max-width:100%;height:auto}figcaption,.small{font-size:.9rem;color:var(--muted)}footer{border-top:1px solid var(--line);font-size:.9rem}.pager{display:flex;gap:1.5rem;justify-content:space-between;margin-top:3rem;flex-wrap:wrap}.sources li{margin:.5rem 0}
@media(max-width:600px){header,main,footer{padding-left:1.1rem;padding-right:1.1rem}main{padding-top:2rem}th,td{padding:.5rem;font-size:.85rem}}
@media print{body{background:white;font-size:11pt}header nav,.button,.skip{display:none}main{padding:0}h1{font-size:25pt}.panel,.card{break-inside:avoid}a{color:inherit}.cards{display:block}.card{margin-bottom:1rem}}
`;

export function searchPages(): Plugin {
  const base = publicSiteUrl(process.env.VITE_PUBLIC_SITE_URL || site.url);
  const revision = process.env.VITE_PUBLIC_SOURCE_REVISION;
  if (revision && !/^[a-f0-9]{40}$/.test(revision))
    throw new Error('Invalid public source revision');
  const source = `${repository}/blob/${revision || `v${ENGINE_VERSION}`}/`;
  const url = (path = '') => new URL(path, base).href;
  const author = {
    '@type': 'Person',
    name: site.author,
    url: 'https://github.com/mohammadrezwankhan',
  };
  const course = {
    '@type': 'Course',
    '@id': url('learn/#course'),
    name: courseName,
    description,
    inLanguage: 'en',
    isAccessibleForFree: true,
    author,
    url: url('learn/'),
    educationalLevel: 'Introductory',
    hasPart: lessons.map((lesson) => ({
      '@type': 'LearningResource',
      name: lesson.title,
      url: url(`learn/${lesson.id}/`),
    })),
  };

  function metadata(pageTitle: string, summary: string, path: string, schema: unknown): string {
    return `<title>${escape(pageTitle)}</title>
<meta name="description" content="${escape(summary)}">
<meta name="author" content="${escape(site.author)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${escape(url(path))}">
<meta property="og:site_name" content="${site.name}">
<meta property="og:title" content="${escape(pageTitle)}"><meta property="og:description" content="${escape(summary)}">
<meta property="og:type" content="website"><meta property="og:url" content="${escape(url(path))}">
<meta property="og:image" content="${escape(url('guide-preview.png'))}">
<meta property="og:image:alt" content="Datacenter Twin Lab: the actual battery ride-through experiment">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(pageTitle)}">
<meta name="twitter:description" content="${escape(summary)}"><meta name="twitter:image" content="${escape(url('guide-preview.png'))}">
<script type="application/ld+json">${json({ '@context': 'https://schema.org', '@graph': Array.isArray(schema) ? schema : [schema] })}</script>`;
  }

  function document(
    pageTitle: string,
    summary: string,
    path: string,
    content: string,
    schema: unknown,
  ): string {
    const root = path.startsWith('learn/') && path !== 'learn/' ? '../../' : '../';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${metadata(pageTitle, summary, path, schema)}<meta name="theme-color" content="#0b655d"><style>${style}</style></head>
<body><a class="skip" href="#main">Skip to content</a><header><a href="${root}">DATACENTER TWIN LAB</a>
<nav aria-label="Site"><a href="${root}learn/">Course notes</a><a href="${root}about/">About &amp; evidence</a><a href="${repository}">GitHub</a></nav></header>
<main id="main">${content}</main><footer>Original teaching material by ${site.author} · Version ${ENGINE_VERSION} · Apache-2.0.<br>
Read the <a href="${source}NOTICE">source notices</a> and <a href="${root}about/">model scope and reproducibility guide</a>.</footer></body></html>`;
  }

  function assumptions(lesson: Lesson, scenarios: Record<string, SiteScenario>): string {
    if (lesson.id === 'pue')
      return `<p>Constant 50,000 kW IT demand over 8,760 hours; assumed PUE of 1.25 or 1.15. This annual planning case has no outage timeline. PUE includes non-IT energy; do not add continuity losses again.</p>`;
    const scenario = lessonScenario(lesson, scenarios[lesson.preset], lesson.initial);
    const rows = [
      ['IT demand / simulated duration', `${scenario.it_demand_kw} kW / ${scenario.duration_s} s`],
      [
        'Opening battery / energy capacity',
        `${scenario.battery_initial_kwh} kWh / ${scenario.battery_capacity_kwh} kWh`,
      ],
      ['Charging power limit', `${scenario.battery_charge_kw} kW`],
      [
        'Charge / discharge efficiency',
        `${scenario.battery_charge_efficiency} / ${scenario.battery_discharge_efficiency}`,
      ],
      ['Distribution efficiency', scenario.distribution_efficiency],
      ['Generator start delay', `${scenario.generator_start_delay_s} s`],
    ];
    return `<div class="table-wrap"><table><caption>Starting case assumptions</caption><tbody>${rows.map(([name, value]) => `<tr><th scope="row">${escape(name)}</th><td>${escape(value)}</td></tr>`).join('')}</tbody></table></div>
<h3>Scheduled events</h3>${scenario.events.length ? `<ul>${scenario.events.map((event) => `<li>${event.at_s} s: ${escape(event.target)} — ${escape(event.action.replaceAll('_', ' '))}${event.value_kw === null ? '' : `, ${escape(event.value_kw)} kW`}</li>`).join('')}</ul>` : '<p>No failure or recovery events are scheduled.</p>'}`;
  }

  return {
    name: 'public-course-search-pages',
    apply: 'build',
    transformIndexHtml(html) {
      const schema = [
        {
          '@type': 'WebSite',
          '@id': url('#website'),
          name: site.name,
          url: base,
          description,
          inLanguage: 'en',
          author,
        },
        {
          '@type': 'SoftwareApplication',
          name: site.name,
          url: base,
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web browser; Python 3.12 or later',
          softwareVersion: ENGINE_VERSION,
          isAccessibleForFree: true,
          license: `${repository}/blob/main/LICENSE`,
          author,
          description:
            'A local-first power-continuity what-if simulator with finite battery energy, generator delay and failure, surviving-path capacity, and reproducible exports.',
        },
      ];
      return html
        .replace(
          '<!-- PUBLIC_COURSE_LINKS -->',
          '<a href="./learn/">Read all twelve course lessons</a> · <a href="./about/">About the author and evidence</a> ·',
        )
        .replace(/<title>[\s\S]*?<\/title>/, '')
        .replace(/<meta\s+(?:name="description"|property="og:[^"]+")[\s\S]*?>/g, '')
        .replace('</head>', `${metadata(title, description, '', schema)}</head>`);
    },
    generateBundle() {
      const scenarios = JSON.parse(
        readFileSync(
          new URL('../../.local/browser-demo-assets/demo-data.json', import.meta.url),
          'utf8',
        ),
      ).scenarios as Record<string, SiteScenario>;
      const emit = (fileName: string, content: string) =>
        this.emitFile({ type: 'asset', fileName, source: content });
      const cards = lessons
        .map(
          (lesson, index) =>
            `<article class="card"><span class="eyebrow">Lesson ${String(index + 1).padStart(2, '0')} / 12</span><h2><a href="${lesson.id}/">${escape(lesson.title.replace(/^\d+\. /, ''))}</a></h2><p>${escape(lesson.question)}</p><span class="small">${escape(lesson.concept)}</span></article>`,
        )
        .join('');
      const graphic = `<figure><svg viewBox="0 0 920 220" role="img" aria-labelledby="reserve-title reserve-desc"><title id="reserve-title">Halving stored energy halves ride-through in the charging-disabled case</title><desc id="reserve-desc">At 1,000 kW, 100 kWh supplies 307.8 seconds; 50 kWh supplies 153.9 seconds after discharge and distribution losses.</desc><rect width="920" height="220" rx="16" fill="#e7f3ee"/><g fill="#173041" font-family="system-ui" font-size="18"><text x="28" y="40">BATTERY RESERVE → DELIVERED TIME AT 1 MW</text><text x="28" y="96">100 kWh</text><text x="28" y="162">50 kWh</text></g><rect x="140" y="65" width="590" height="43" rx="6" fill="#09685e"/><rect x="140" y="132" width="295" height="43" rx="6" fill="#236fb0"/><g fill="white" font-family="system-ui" font-size="20" font-weight="700"><text x="162" y="93">307.8 s</text><text x="162" y="161">153.9 s</text></g><text x="28" y="202" fill="#425c6b" font-family="system-ui" font-size="15">Charging disabled · 90% discharge efficiency · 95% distribution efficiency</text></svg><figcaption>Original calculation diagram. Duration starts at the utility outage; it is not an elapsed event timestamp.</figcaption></figure>`;
      emit(
        'learn/index.html',
        document(
          courseName + ' | Free Course Notes',
          description,
          'learn/',
          `
<p class="eyebrow">The power playbook / 12 practical lessons</p><h1>${courseName}</h1>
<p class="lead">A generator fails. The battery takes over. Can you predict when the lights go out?</p>
<p>Start with a 1 MW load and a 100 kWh battery, then change one assumption at a time. Read the calculations here, run each experiment in your browser, and compare the result with the reference Python engine.</p>
<p><a class="button" href="../?lesson=ride-through">Try the battery experiment →</a></p>
<div class="tags"><span>Free · no account</span><span>Browser + Python</span><span>Predict · run · explain</span></div>${graphic}
<h2>Build your power-systems intuition</h2><p>For datacenter engineers learning power continuity. Begin with power and energy, work through outages and shared failures, then compare aggregate AI demand and annual PUE planning. Basic arithmetic is enough to start.</p><div class="cards">${cards}</div>
<section class="panel"><h2>What these experiments establish</h2><p>These are deterministic synthetic electrical examples with explicit units, input scenarios and downloadable results. They teach reserve accounting and failure-path reasoning. They do not predict GPU jobs, grid adequacy, electrical transients or certified facility uptime.</p><p><a href="../about/">Read about the author, model scope and reproducibility evidence →</a></p></section>`,
          course,
        ),
      );

      lessons.forEach((lesson, index) => {
        const path = `learn/${lesson.id}/`;
        const cleanTitle = lesson.title.replace(/^\d+\. /, '');
        const resource = {
          '@type': 'LearningResource',
          '@id': url(path),
          url: url(path),
          name: cleanTitle,
          description: lesson.question,
          learningResourceType: 'Lesson',
          educationalLevel: 'Introductory',
          inLanguage: 'en',
          isAccessibleForFree: true,
          author,
          isPartOf: { '@id': url('learn/#course') },
          teaches: lesson.concept,
          version: ENGINE_VERSION,
        };
        const breadcrumbs = {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: site.name, item: base },
            { '@type': 'ListItem', position: 2, name: courseName, item: url('learn/') },
            { '@type': 'ListItem', position: 3, name: cleanTitle, item: url(path) },
          ],
        };
        emit(
          path + 'index.html',
          document(
            `${cleanTitle} | Datacenter Power Lesson ${index + 1}`,
            lesson.question,
            path,
            `
<p class="eyebrow">Lesson ${String(index + 1).padStart(2, '0')} / 12 · ${escape(lesson.concept)}</p>
<h1>${escape(cleanTitle)}</h1><p class="lead">${escape(lesson.question)}</p>
<p><a class="button" href="../../?lesson=${lesson.id}">Run this browser lesson →</a></p>
<section class="panel"><h2>Predict before you run</h2><p>Write down your prediction, then change only the input below. In the interactive lesson, compare the starting case with the challenge and export a worksheet to retain your reasoning.</p>
<div class="table-wrap"><table><caption>The two lesson configurations</caption><thead><tr><th scope="col">Input</th><th scope="col">Starting value</th><th scope="col">Challenge value</th></tr></thead><tbody><tr><th scope="row">${escape(lesson.label)}</th><td>${escape(lesson.initial)} ${escape(lesson.unit)}</td><td>${escape(lesson.challenge)} ${escape(lesson.unit)}</td></tr></tbody></table></div><p class="small">Reported quantity: ${escape(lesson.resultUnit)}. The live control accepts ${lesson.min}–${lesson.max}${lesson.unit ? ` ${escape(lesson.unit)}` : ''}.</p></section>
<section class="panel answer" id="worked-answer"><h2>Worked answer</h2><p>${escape(lesson.explanation)}</p></section>
<h2>Reproduce the configuration</h2>${assumptions(lesson, scenarios)}
<p>${lesson.id === 'pue' ? 'This lesson builds an annual planning case for the fixed IT demand and duration above; it does not use an outage preset.' : `The browser lesson applies its configuration to the <code>${escape(lesson.preset)}</code> preset.`} Open it above, run the starting case, switch to the challenge, and use “Verify against Python” to compare complete results. Use the worksheet export to keep the prediction, completed inputs and answer together.</p>
<h2>Sources and verification</h2><ul class="sources"><li><a href="${source}apps/web/src/course-lessons.ts">Exact lesson definitions and input transformations</a></li><li><a href="${source}tests/test_course_lessons.py">Native Python default/challenge checks</a></li><li><a href="${source}docs/canonical-case.md">1 MW equations and independent energy-ledger reconstruction</a></li><li><a href="${source}docs/engineering/electrical-continuity.md">Electrical continuity contract</a></li></ul>
<p class="small">Original material by ${site.author}, engine ${ENGINE_VERSION}. Synthetic teaching cases; no facility calibration or independent external reproduction has been established. Annual PUE planning and outage continuity are different calculations. <a href="../../about/">Full scope and evidence</a>.</p>
<nav class="pager" aria-label="Lesson sequence">${index ? `<a href="../${lessons[index - 1].id}/">← ${escape(lessons[index - 1].title)}</a>` : '<a href="../">← Course index</a>'}${index < lessons.length - 1 ? `<a href="../${lessons[index + 1].id}/">${escape(lessons[index + 1].title)} →</a>` : '<a href="../">Back to all lessons →</a>'}</nav>`,
            [resource, breadcrumbs],
          ),
        );
      });

      emit(
        'about/index.html',
        document(
          'About, Model Scope & Reproducibility | Datacenter Twin Lab',
          'Author, exact model scope, reproducibility records and citation guidance for the Datacenter Twin Lab power-continuity course.',
          'about/',
          `
<p class="eyebrow">About the lab / evidence you can inspect</p><h1>Understand the model. Reproduce the result.</h1>
<p class="lead">Datacenter Twin Lab is a local-first power-continuity what-if simulator and a twelve-lesson course for datacenter engineers.</p>
<p>Created and maintained by <a href="https://github.com/mohammadrezwankhan">Mohammad Rezwan Khan</a>. The project is open source under Apache-2.0. It runs on your device without an account or shared simulation backend.</p>
<section class="panel answer"><h2>How long does 100 kWh support a 1 MW load?</h2><p>For this fixed-load example, 100 kWh × 0.90 discharge efficiency × 0.95 distribution efficiency = 85.5 kWh delivered. That is 307.8 seconds at 1,000 kW. With 50 kWh, it is 153.9 seconds. Charging is disabled; utility and generator fail at 300 seconds and recover at 900 seconds.</p><p><a href="../learn/ride-through/">Read the assumptions and run the experiment →</a></p></section>
<h2>What the simulator does</h2><p>It accounts for finite battery energy, charging and losses, generator startup and failure, surviving-path capacity, shared failure domains, timed recovery and unserved energy. The fast JavaScript path can be checked on demand against the Python reference. Eighteen presets and twelve lessons use explicit inputs and unit-labelled results.</p>
<h2>What the evidence means</h2><p>The tests and published packets establish reproducible software behavior for the declared inputs. They do not establish facility calibration, AC transients, protection coordination, GPU workload performance, grid adequacy, certified uptime or equipment safety. This software does not control equipment. Independent external reproduction has not yet been obtained.</p>
<h2>Inspect or cite the work</h2><ul class="sources"><li><a href="${repository}/releases/tag/v${ENGINE_VERSION}">Version ${ENGINE_VERSION} source, packages and release evidence</a></li><li><a href="${source}docs/canonical-case.md">Canonical input equations and reconstruction instructions</a></li><li><a href="../data/evidence/v${ENGINE_VERSION}/manifest.json">Versioned evidence manifest with per-file hashes</a></li><li><a href="${source}CITATION.cff">Author and software citation record</a></li><li><a href="${source}docs/validation/review-protocol.md">External reproduction protocol and scope</a></li><li><a href="${source}docs/quickstart.md">Install and run with Python</a></li></ul>
<h2>How to contribute</h2><p>Try one lesson, note anything confusing and describe the steps to reproduce it. A clearer explanation, a documentation fix or an independently derived example can help the next learner. Read the <a href="${source}CONTRIBUTING.md">contribution guide</a> or <a href="${repository}/issues">open an issue</a>.</p>
<p><a class="button" href="../learn/">Explore the twelve lessons →</a></p>`,
          {
            '@type': 'AboutPage',
            name: 'About Datacenter Twin Lab',
            url: url('about/'),
            author,
            about: { '@id': url('#website') },
          },
        ),
      );
      const paths = ['', 'learn/', ...lessons.map((lesson) => `learn/${lesson.id}/`), 'about/'];
      emit(
        'sitemap.xml',
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${escape(url(path))}</loc></url>`).join('')}</urlset>\n`,
      );
      emit('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${url('sitemap.xml')}\n`);
      emit(
        '404.html',
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page not found | Datacenter Twin Lab</title></head><body><h1>Page not found</h1><p>The requested page is unavailable.</p><p><a href="' +
          escape(base) +
          '">Open Datacenter Twin Lab</a></p></body></html>',
      );
    },
  };
}
