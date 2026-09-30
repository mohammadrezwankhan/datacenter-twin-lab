import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { lessons, lessonScenario, type Lesson } from './src/course-lessons.ts';
import { ENGINE_VERSION } from './src/js-engine/version.ts';
import type { SiteScenario } from './src/types.ts';
import type { Run } from './src/types.ts';
import site from './site.config.json' with { type: 'json' };
import { displayQuantity, lessonRecords, type EvidenceIndex } from './seo-records';
import { emtPage } from './seo-emt';
import { researchPage } from './seo-research';

const repository = 'https://github.com/mohammadrezwankhan/datacenter-twin-lab';
const title = 'Datacenter Power Systems: Free Interactive Course | Datacenter Twin Lab';
const description =
  'Learn datacenter power continuity with 12 free browser lessons. Predict battery ride-through, test generator failures, and reproduce the energy balance in Python.';
const courseName = 'Power Systems for Datacenter Engineers';
const entities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, (c) => entities[c]);
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
a{color:#005d82;text-underline-offset:.2em;overflow-wrap:anywhere}a:hover{color:#00364c}a:focus-visible{outline:3px solid #a44806;outline-offset:4px}
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
.byline{font-size:.9rem;color:var(--muted)}.anchor{font-size:.85rem;font-weight:500;white-space:nowrap}.result-value{font-size:1.2rem;font-weight:750;font-variant-numeric:tabular-nums}.citation,code,pre{overflow-wrap:anywhere;word-break:break-word}pre{white-space:pre-wrap;background:#edf3f1;padding:1rem;border-radius:.5rem}.case-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:1rem}.case-grid .panel{margin:0}.case-grid h2{margin-top:.5rem}.case-grid .result-value{color:var(--teal)}.jump-links{display:flex;flex-wrap:wrap;gap:.5rem 1.2rem;margin:1.5rem 0}.section-link{scroll-margin-top:1rem}
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
    '@id': url('about/#author'),
    name: site.author,
    url: url('about/#author'),
    sameAs: 'https://github.com/mohammadrezwankhan',
  };
  const course = {
    '@type': 'Course',
    '@id': url('learn/#course'),
    name: courseName,
    description,
    inLanguage: 'en',
    isAccessibleForFree: true,
    author,
    license: `${source}LICENSE`,
    url: url('learn/'),
    educationalLevel: 'Introductory',
    hasPart: lessons.map((lesson) => ({
      '@type': 'LearningResource',
      '@id': url(`learn/${lesson.id}/#lesson`),
      name: lesson.title,
      url: url(`learn/${lesson.id}/`),
    })),
  };

  function metadata(pageTitle: string, summary: string, path: string, schema: unknown): string {
    return `<title>${escape(pageTitle)}</title>
${site.googleSiteVerification && path === '' && base === site.url ? `<meta name="google-site-verification" content="${escape(site.googleSiteVerification)}">` : ''}
<meta name="description" content="${escape(summary)}">
<meta name="author" content="${escape(site.author)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="${escape(url(path))}">
<link rel="license" href="${escape(source)}LICENSE">
<meta property="og:site_name" content="${site.name}">
<meta property="og:title" content="${escape(pageTitle)}"><meta property="og:description" content="${escape(summary)}">
<meta property="og:type" content="website"><meta property="og:url" content="${escape(url(path))}">
<meta property="og:image" content="${escape(url('guide-preview.png'))}">
<meta property="og:image:width" content="1280"><meta property="og:image:height" content="900">
<meta property="og:locale" content="en_US">
<meta property="og:image:alt" content="Datacenter Twin Lab: the actual battery ride-through experiment">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(pageTitle)}">
<meta name="twitter:description" content="${escape(summary)}"><meta name="twitter:image" content="${escape(url('guide-preview.png'))}">
<meta name="twitter:image:alt" content="Datacenter Twin Lab: the actual battery ride-through experiment">
<script type="application/ld+json">${json({ '@context': 'https://schema.org', '@graph': Array.isArray(schema) ? schema : [schema] })}</script>`;
  }

  function document(
    pageTitle: string,
    summary: string,
    path: string,
    content: string,
    schema: unknown,
  ): string {
    const root = '../'.repeat(path.split('/').filter(Boolean).length);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${metadata(pageTitle, summary, path, schema)}<link rel="icon" type="image/png" sizes="96x96" href="${root}favicon.png"><meta name="theme-color" content="#0b655d"><style>${style}</style></head>
<body><a class="skip" href="#main">Skip to content</a><header><a href="${root}">DATACENTER TWIN LAB</a>
<nav aria-label="Site"><a href="${root}learn/">Course notes</a><a href="${root}evidence/">Results &amp; sources</a><a href="${root}about/">About the lab</a><a href="${repository}">GitHub</a></nav></header>
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
          '@id': url('#simulator'),
          name: site.name,
          url: base,
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web browser; Python 3.12 or later',
          softwareVersion: ENGINE_VERSION,
          isAccessibleForFree: true,
          license: `${source}LICENSE`,
          author,
          description:
            'A local-first power-continuity what-if simulator with finite battery energy, generator delay and failure, surviving-path capacity, and reproducible exports.',
        },
        {
          '@type': 'WebPage',
          '@id': url('#page'),
          url: base,
          name: title,
          description,
          isPartOf: { '@id': url('#website') },
          mainEntity: { '@id': url('#simulator') },
          author,
          inLanguage: 'en',
        },
      ];
      return html
        .replace(
          '<!-- PUBLIC_COURSE_LINKS -->',
          '<a href="./learn/">Read all twelve course lessons</a> · <a href="./studies/emt/">Explore the EMT study</a> · <a href="./studies/power-dynamics/">Power dynamics studies</a> · <a href="./evidence/">Reference results and source records</a> · <a href="./about/">About the author and evidence</a> ·',
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
      const evidence = JSON.parse(
        readFileSync(
          new URL('../../.local/browser-demo-assets/evidence-index.json', import.meta.url),
          'utf8',
        ),
      ) as EvidenceIndex;
      if (evidence.version !== ENGINE_VERSION || evidence.cases.length !== 3)
        throw new Error('Expected the current three-case evidence index');
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
<p class="byline">Original course by <a href="../about/#author">${site.author}</a> · Engine ${ENGINE_VERSION} · <a href="../evidence/">Reference results and citation records</a></p>
<p><a class="button" href="../?lesson=ride-through">Try the battery experiment →</a></p>
<div class="tags"><span>Free · no account</span><span>Browser + Python</span><span>Predict · run · explain</span></div>${graphic}
<h2>Build your power-systems intuition</h2><p>For datacenter engineers learning power continuity. Begin with power and energy, work through outages and shared failures, then compare aggregate AI demand and annual PUE planning. Basic arithmetic is enough to start.</p><div class="cards">${cards}</div>
<section class="panel"><h2>Go inside a voltage sag</h2><p>Ready for a different timescale? The separate <a href="../studies/emt/">EMT fundamentals study</a> explores a 200 ms ideal DC-link RLC transient with waveforms, an energy ledger and step-refinement checks. Continue with five <a href="../studies/power-dynamics/">advanced power-dynamics studies</a> of converter response and grid modes.</p></section>
<section class="panel"><h2>What these twelve experiments establish</h2><p>These are deterministic synthetic electrical examples with explicit units, input scenarios and downloadable results. They teach reserve accounting and failure-path reasoning. They do not predict GPU jobs, grid adequacy, electrical transients or certified facility uptime.</p><p><a href="../about/">Read about the author, model scope and reproducibility evidence →</a></p></section>`,
          course,
        ),
      );

      lessons.forEach((lesson, index) => {
        const path = `learn/${lesson.id}/`;
        const cleanTitle = lesson.title.replace(/^\d+\. /, '');
        const records = lessonRecords(lesson, scenarios);
        const sources = [
          ['Lesson definitions and input transformations', 'apps/web/src/course-lessons.ts'],
          ['Native Python default/challenge checks', 'tests/test_course_lessons.py'],
          ['Electrical continuity contract', 'docs/engineering/electrical-continuity.md'],
        ];
        emit(
          path + 'results.json',
          JSON.stringify(
            {
              schema_version: 1,
              lesson_id: lesson.id,
              lesson_url: url(path),
              engine_version: ENGINE_VERSION,
              source_revision: revision ?? `v${ENGINE_VERSION}`,
              result_unit: lesson.resultUnit,
              records,
            },
            null,
            2,
          ) + '\n',
        );
        const resource = {
          '@type': 'LearningResource',
          '@id': url(path + '#lesson'),
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
          license: `${source}LICENSE`,
          citation: sources.map(([name, file]) => ({
            '@type': 'CreativeWork',
            name,
            url: source + file,
          })),
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
<p class="byline">By <a href="../../about/#author">${site.author}</a> · Engine ${ENGINE_VERSION} · <a href="#cite">Cite this lesson</a></p>
<p><a class="button" href="../../?lesson=${lesson.id}">Run this browser lesson →</a></p>
<section class="panel"><h2>Predict before you run</h2><p>Write down your prediction, then change only the input below. In the interactive lesson, compare the starting case with the challenge and export a worksheet to retain your reasoning.</p>
<div class="table-wrap"><table><caption>The two lesson configurations</caption><thead><tr><th scope="col">Input</th><th scope="col">Starting value</th><th scope="col">Challenge value</th></tr></thead><tbody><tr><th scope="row">${escape(lesson.label)}</th><td>${escape(lesson.initial)} ${escape(lesson.unit)}</td><td>${escape(lesson.challenge)} ${escape(lesson.unit)}</td></tr></tbody></table></div><p class="small">Reported quantity: ${escape(lesson.resultUnit)}. The live control accepts ${lesson.min}–${lesson.max}${lesson.unit ? ` ${escape(lesson.unit)}` : ''}.</p></section>
<section class="panel answer section-link" id="worked-answer"><h2>Worked answer <a class="anchor" href="#worked-answer">Link to this answer</a></h2><p>${escape(lesson.explanation)}</p>
<div class="table-wrap"><table id="calculated-results"><caption>Calculated results · ${escape(lesson.resultUnit)}</caption><thead><tr><th scope="col">Configuration</th><th scope="col">${escape(lesson.label)}</th><th scope="col">Result (${escape(lesson.resultUnit)})</th></tr></thead><tbody>${records.map((record, row) => `<tr><th scope="row">${row ? 'Challenge' : 'Starting case'}</th><td>${escape(record.input)} ${escape(lesson.unit)}</td><td class="result-value" data-result="${escape(record.result)}">${escape(displayQuantity(record.result))}</td></tr>`).join('')}</tbody></table></div>
<p class="small">Calculated from the same inputs as the interactive lesson. Display rounded to six decimal places; full decimal strings, inputs and energy records are in the <a href="results.json">downloadable result record</a>. ${lesson.resultUnit === 's elapsed' ? 'Elapsed seconds start at simulation time zero; ride-through starts at the outage.' : ''}</p></section>
<h2>Reproduce the configuration</h2>${assumptions(lesson, scenarios)}
<p>${lesson.id === 'pue' ? 'This lesson builds an annual planning case for the fixed IT demand and duration above; it does not use an outage preset.' : `The browser lesson applies its configuration to the <code>${escape(lesson.preset)}</code> preset.`} Open it above, run the starting case, switch to the challenge, and use “Verify against Python” to compare complete results. Use the worksheet export to keep the prediction, completed inputs and answer together.</p>
<h2>Sources and verification</h2><ul class="sources">${sources.map(([name, file]) => `<li><a href="${escape(source + file)}">${escape(name)}</a></li>`).join('')}<li><a href="../../evidence/">Three reference cases, equations and versioned source records</a></li></ul>
<section id="cite" class="panel section-link"><h2>Cite this lesson</h2><p class="citation">${site.author}. “${escape(cleanTitle)}.” Datacenter Twin Lab, engine ${ENGINE_VERSION}. <a href="${escape(url(path))}">${escape(url(path))}</a></p><p class="small">Documentation source: <a href="${escape(source)}apps/web/src/course-lessons.ts">${revision || `v${ENGINE_VERSION}`}</a>. For a numerical claim, also retain the completed inputs and the <a href="results.json">result record</a>; the live lesson can be changed by its controls.</p></section>
<p class="small">Original material by ${site.author}, engine ${ENGINE_VERSION}. Synthetic teaching cases; no facility calibration or independent external reproduction has been established. Annual PUE planning and outage continuity are different calculations. <a href="../../about/">Full scope and evidence</a>.</p>
<nav class="pager" aria-label="Lesson sequence">${index ? `<a href="../${lessons[index - 1].id}/">← ${escape(lessons[index - 1].title)}</a>` : '<a href="../">← Course index</a>'}${index < lessons.length - 1 ? `<a href="../${lessons[index + 1].id}/">${escape(lessons[index + 1].title)} →</a>` : '<a href="../">Back to all lessons →</a>'}</nav>`,
            [
              resource,
              breadcrumbs,
              {
                '@type': 'WebPage',
                '@id': url(path + '#page'),
                url: url(path),
                name: cleanTitle,
                isPartOf: { '@id': url('#website') },
                mainEntity: { '@id': resource['@id'] },
                breadcrumb: breadcrumbs,
                inLanguage: 'en',
              },
            ],
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
<p id="author">Created and maintained by <a href="https://github.com/mohammadrezwankhan">Mohammad Rezwan Khan</a>. The project is open source under Apache-2.0. It runs on your device without an account or shared simulation backend.</p>
<p>Development and educational writing use AI assistance. Numerical examples are checked with stated equations, the Python reference engine and browser tests; those maintainer checks are distinct from independent external review. Inspect the <a href="../evidence/">reference results and complete records</a> to follow a claim back to its inputs.</p>
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
      const caseRows = evidence.cases
        .map((item) => {
          if (!/^data\/evidence\/v[\w.-]+\/run-[\w.-]+\.json$/.test(item.run_path))
            throw new Error('Unexpected public evidence path');
          const run = JSON.parse(
            readFileSync(
              new URL('../../.local/browser-demo-assets/' + item.run_path, import.meta.url),
              'utf8',
            ),
          ) as Run;
          if (run.engine_version !== ENGINE_VERSION || run.input_sha256 !== item.input_sha256)
            throw new Error('Reference result identity mismatch');
          return `<tr><th scope="row"><a href="#${escape(item.id)}">${escape(item.title)}</a></th>
<td>${escape(displayQuantity(run.summary.requested_it_kwh))}</td>
<td>${escape(displayQuantity(run.summary.served_it_kwh))}</td>
<td>${escape(displayQuantity(run.summary.unserved_it_kwh))}</td></tr>`;
        })
        .join('');
      const evidenceCards = evidence.cases
        .map(
          (item, index) => `<article class="panel section-link" id="${escape(item.id)}">
<span class="eyebrow">Reference ${String(index + 1).padStart(2, '0')}</span>
<h2>${escape(item.title)}</h2><p class="result-value">${escape(item.outcome)}</p>
<p class="equation">${escape(item.equation)}</p>
<p><a href="#${escape(item.id)}">Link to this result</a> · <a href="../${escape(item.report_path)}">Readable full report</a></p>
<p class="small"><a href="../${escape(item.scenario_path)}">Scenario JSON</a> · <a href="../${escape(item.run_path)}">Complete result JSON</a></p>
<details><summary>Identity and pinned source</summary><p class="small">Input SHA-256: <code>${escape(item.input_sha256)}</code></p>
<p class="small">Run: <code>${escape(item.run_id)}</code>. <a href="${escape(source + item.run_path)}">Result at the cited source revision</a>.</p></details></article>`,
        )
        .join('');
      const evidenceDescription =
        'Check three reproducible datacenter power-continuity cases: 307.8 and 153.9 seconds of battery ride-through, plus a 665 kW surviving path. Equations, inputs and complete results.';
      const dataset = {
        '@type': 'Dataset',
        '@id': url('evidence/#reference-packet'),
        name: `Datacenter Twin Lab ${ENGINE_VERSION} synthetic continuity reference cases`,
        description: evidenceDescription,
        url: url('evidence/'),
        creator: author,
        version: ENGINE_VERSION,
        license: source + 'LICENSE',
        isAccessibleForFree: true,
        measurementTechnique:
          'Deterministic synthetic electrical continuity simulation with explicit events, finite storage and exact energy accounting. No facility measurements.',
        variableMeasured: [
          'Requested IT energy (kWh)',
          'Served IT energy (kWh)',
          'Unserved IT energy (kWh)',
        ],
        distribution: evidence.cases.flatMap((item) => [
          {
            '@type': 'DataDownload',
            name: item.title + ' inputs',
            encodingFormat: 'application/json',
            contentUrl: url(item.scenario_path),
          },
          {
            '@type': 'DataDownload',
            name: item.title + ' complete result',
            encodingFormat: 'application/json',
            contentUrl: url(item.run_path),
          },
        ]),
        citation: source + 'docs/canonical-case.md',
      };
      emit(
        'evidence/index.html',
        document(
          'Datacenter Power Continuity: Results & Reproducibility Evidence',
          evidenceDescription,
          'evidence/',
          `
<p class="eyebrow">Reference desk / inputs, arithmetic, evidence</p>
<h1>Check the number.<br>Cite the evidence.</h1>
<p class="lead">Three datacenter power-continuity cases you can calculate by hand, run in the browser and reproduce in Python.</p>
<p class="byline">Original examples by <a href="../about/#author">${site.author}</a> · Engine ${ENGINE_VERSION} · <a href="#cite">Citation and source revision</a></p>
<nav class="jump-links" aria-label="On this page"><a href="#quick-answer">Battery runtime answer</a><a href="#reference-packet">Three reference cases</a><a href="#reproduce">Reproduce the results</a><a href="#cite">Cite the work</a></nav>
<section class="panel answer section-link" id="quick-answer"><h2>How long does 100 kWh supply a 1 MW load?</h2>
<p><strong>307.8 seconds in this charging-disabled example.</strong> Stored energy × discharge efficiency × distribution efficiency gives delivered energy: 100 × 0.90 × 0.95 = 85.5 kWh. Divide by 1,000 kW and multiply by 3,600 to convert hours to seconds. With 50 kWh, the same assumptions give 153.9 seconds.</p>
<p>These are durations after the utility outage. With the outage beginning at 300 s, depletion occurs at 607.8 s or 453.9 s elapsed. An event timestamp and a ride-through duration describe different quantities.</p>
<p><a class="button" href="../?lesson=ride-through">Run the 100 / 50 kWh lesson →</a></p></section>
${graphic}
<section id="reference-packet" class="section-link"><h2>Three reference cases, one inspectable ledger</h2>
<p>The battery cases use 1,000 kW IT demand, 100 or 50 kWh opening energy, charging disabled, utility and generator failure at 300 s and recovery at 900 s, 90% discharge efficiency and 95% distribution efficiency. For path maintenance, one 700 kW gross path remains for 600 s: it delivers 665 kW and leaves a 335 kW deficit.</p>
<div class="case-grid">${evidenceCards}</div>
<div class="table-wrap"><table><caption>Energy accounting over each complete 1,800-second run · kWh</caption><thead><tr><th scope="col">Case</th><th scope="col">Requested IT</th><th scope="col">Served IT</th><th scope="col">Unserved IT</th></tr></thead><tbody>${caseRows}</tbody></table></div>
<p class="small">The energy table rounds to six decimal places; the case summaries may be shorter. JSON records retain the complete decimal strings and interval ledger. Input-hash filenames identify each configuration; retain the source revision and <a href="../${escape(evidence.manifest_path)}">manifest</a> when citing a result.</p></section>
<section id="reproduce" class="section-link"><h2>Reproduce the result before using it</h2>
<ol><li>Download the <a href="${repository}/releases/tag/v${ENGINE_VERSION}">version ${ENGINE_VERSION} source and evidence assets</a>, or check out the exact public source revision linked below.</li>
<li>From that source directory, build and verify the three-case packet with Python 3.12 or later:</li></ol>
<pre><code>python scripts/build_evidence.py --output outputs/reproduction-${ENGINE_VERSION}
python scripts/build_evidence.py --verify outputs/reproduction-${ENGINE_VERSION}</code></pre>
<p>Reconstruct the ledger from its terms, independently of the reported residual: source energy equals served IT energy plus the change in stored battery energy and the conversion losses. Requested IT energy equals served plus unserved IT energy.</p>
<ul class="sources"><li><a href="${source}docs/canonical-case.md">Equations, exact configuration and ledger reconstruction</a></li>
<li><a href="${source}docs/validation/evidence-method.md">Reproduction method and decimal tolerance</a></li>
<li><a href="${source}scripts/build_evidence.py">Packet builder and verifier at the cited source</a></li>
<li><a href="../${escape(evidence.receipt_path)}">Versioned expected-versus-observed receipt</a></li></ul></section>
<section id="cite" class="panel section-link"><h2>Cite the claim and its configuration</h2>
<p class="citation">${site.author}. Datacenter Twin Lab, version ${ENGINE_VERSION}. Synthetic continuity reference cases. <a href="${url('evidence/')}">${url('evidence/')}</a></p>
<p>For numerical reuse, include the case name, input SHA-256, engine version, result file and exact source revision. Documentation for this build: <a href="${source}docs/canonical-case.md">${revision || `v${ENGINE_VERSION}`}</a>. Use the <a href="${source}CITATION.cff">software citation record</a> for author and repository details.</p>
<p class="small">This is a software reproduction record, not a peer-reviewed paper or a calibrated facility dataset. No DOI or independent external reproduction is asserted. Original code and inputs are Apache-2.0; <a href="${source}NOTICE">source notices</a> describe the material included.</p></section>
<h2>What can these results support?</h2><p>They support learning about finite reserve, losses, outage timing and path capacity for the stated synthetic inputs. They do not establish equipment suitability, facility uptime, grid adequacy, GPU job performance or physical safety. See the <a href="../about/">model scope and authorship</a> and <a href="${source}docs/validation/review-protocol.md">external reproduction protocol</a>.</p>
<p><a href="../learn/">Explore all twelve worked lessons →</a></p>`,
          [
            dataset,
            {
              '@type': 'WebPage',
              '@id': url('evidence/#page'),
              url: url('evidence/'),
              name: 'Datacenter power continuity reference results',
              description: evidenceDescription,
              isPartOf: { '@id': url('#website') },
              mainEntity: { '@id': dataset['@id'] },
              author,
              inLanguage: 'en',
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: site.name, item: base },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Results and sources',
                  item: url('evidence/'),
                },
              ],
            },
          ],
        ),
      );
      const emt = emtPage(source);
      emit(
        'studies/emt/index.html',
        document(
          'DC-link EMT Study: Voltage Sag and Recovery | Datacenter Twin Lab',
          'Explore a 200 ms DC-link RLC transient with interactive voltage and current plots, an energy ledger and reproducible Python calculations.',
          'studies/emt/',
          emt.content,
          {
            '@type': 'LearningResource',
            '@id': url('studies/emt/#study'),
            name: 'Inside a voltage sag',
            url: url('studies/emt/'),
            author,
            learningResourceType: 'Interactive study',
            isAccessibleForFree: true,
            inLanguage: 'en',
            description:
              'An original ideal DC-link RLC teaching circuit, with equations, assumptions and numerical checks.',
          },
        ),
      );
      emit('studies/emt/default-config.json', JSON.stringify(emt.result.config, null, 2) + '\n');
      emit('studies/emt/default-result.json', JSON.stringify(emt.result) + '\n');
      emit(
        'studies/power-dynamics/index.html',
        document(
          'Power Dynamics Studies: Converter Response and Grid Modes | Datacenter Twin Lab',
          'Five interactive Python studies explore load steps, converter modes, synthetic load spectra, abc versus QSS models and a modified nine-bus network.',
          'studies/power-dynamics/',
          researchPage(source),
          {
            '@type': 'LearningResource',
            '@id': url('studies/power-dynamics/#studies'),
            name: 'Power dynamics study studio',
            url: url('studies/power-dynamics/'),
            author,
            learningResourceType: 'Interactive study collection',
            isAccessibleForFree: true,
            inLanguage: 'en',
          },
        ),
      );
      const paths = [
        '',
        'learn/',
        ...lessons.map((lesson) => `learn/${lesson.id}/`),
        'evidence/',
        'about/',
        'studies/emt/',
        'studies/power-dynamics/',
      ];
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
