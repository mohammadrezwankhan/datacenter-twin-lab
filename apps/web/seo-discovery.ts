import type { LessonNavigation } from './src/curriculum';

export type PublicAuthor = {
  '@type': 'Person';
  '@id': string;
  name: string;
  url: string;
  sameAs?: string;
};

export type CourseSchema = {
  '@type': 'Course';
  '@id': string;
  name: string;
  description: string;
  inLanguage: string;
  isAccessibleForFree: boolean;
  author: PublicAuthor;
  license: string;
  url: string;
  educationalLevel: string;
  hasPart: Array<{
    '@type': 'LearningResource';
    '@id': string;
    name: string;
    url: string;
  }>;
};

export type SoftwareApplicationSchema = {
  '@type': 'SoftwareApplication';
  '@id': string;
  name: string;
  url: string;
  applicationCategory: string;
  operatingSystem: string;
  softwareVersion: string;
  isAccessibleForFree: boolean;
  license: string;
  author: PublicAuthor;
  description: string;
};

export function createCourseSchema(options: {
  base: string;
  name: string;
  description: string;
  author: PublicAuthor;
  license: string;
  lessons: readonly LessonNavigation[];
}): CourseSchema {
  const url = (path: string) => new URL(path, options.base).href;
  return {
    '@type': 'Course',
    '@id': url('learn/#course'),
    name: options.name,
    description: options.description,
    inLanguage: 'en',
    isAccessibleForFree: true,
    author: options.author,
    license: options.license,
    url: url('learn/'),
    educationalLevel: 'Introductory',
    hasPart: options.lessons.map((lesson) => ({
      '@type': 'LearningResource',
      '@id': url(`${lesson.readingRoute}#lesson`),
      name: lesson.title,
      url: url(lesson.readingRoute),
    })),
  };
}

export function createSoftwareApplicationSchema(options: {
  base: string;
  name: string;
  version: string;
  author: PublicAuthor;
  license: string;
  description: string;
}): SoftwareApplicationSchema {
  return {
    '@type': 'SoftwareApplication',
    '@id': new URL('#simulator', options.base).href,
    name: options.name,
    url: options.base,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web browser; Python 3.12 or later',
    softwareVersion: options.version,
    isAccessibleForFree: true,
    license: options.license,
    author: options.author,
    description: options.description,
  };
}

export function buildDiscoveryDocuments(options: {
  base: string;
  siteName: string;
  repository: string;
  author: PublicAuthor;
  course: CourseSchema;
  softwareApplication: SoftwareApplicationSchema;
}): {
  llmsText: string;
  knowledgeGraphJson: string;
  knowledgeGraphJsonLd: string;
} {
  const website = {
    '@type': 'WebSite',
    '@id': new URL('#website', options.base).href,
    name: options.siteName,
    url: options.base,
    description: options.course.description,
    inLanguage: 'en',
    author: options.author,
  };
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [options.author, website, options.softwareApplication, options.course],
  };
  const serializedGraph = `${JSON.stringify(graph, null, 2)}\n`;
  const lessons = options.course.hasPart
    .map((lesson) => `- [${lesson.name}](${lesson.url})`)
    .join('\n');
  const llmsText = `# ${options.siteName} — Course and software index
Canonical URL: ${options.base}
Maintainer: ${options.author.name} (${options.author['@id']})
Repository: ${options.repository}
Software version: ${options.softwareApplication.softwareVersion}

## About
${options.course.description}

The browser app presents educational power-continuity scenarios, a separate simplified EMT study, and power-dynamics studies. The course is free to read and its lesson pages describe their assumptions and evidence.

## Course
Name: ${options.course.name}
Canonical Course ID: ${options.course['@id']}
Course page: ${options.course.url}
Free lessons: ${String(options.course.hasPart.length)}

${lessons}

## Model scope
Continuity scenarios use synthetic, uncalibrated educational inputs. Their outputs are illustrative and are not facility measurements, facility predictions, equipment ratings, protection settings, or certification.

The separate EMT study is a simplified DC-equivalent circuit with R, L, C and a resistive load. It does not model inverter controls, ATS transfer behavior, generator synchronization, or protection operation. See the study page for its assumptions and evidence.

## Further reading
- [Course notes](${new URL('learn/', options.base).href})
- [Reference results and sources](${new URL('evidence/', options.base).href})
- [About the author and evidence](${new URL('about/', options.base).href})
- [EMT study](${new URL('studies/emt/', options.base).href})
- [Power-dynamics studies](${new URL('studies/power-dynamics/', options.base).href})
- [Visible page text summaries](${new URL('llms-full.txt', options.base).href})
- [Core authority hub](https://mrkhan.co.technology/)
- [Hybrid Microgrid Simulator](https://mkgrid.co.technology/)
- [Wind Market Arbitrage Desk](https://mktrade.co.business/)
- [Engineering Browser Apps](https://mklab.co.technology/)
`;
  return {
    llmsText,
    knowledgeGraphJson: serializedGraph,
    knowledgeGraphJsonLd: serializedGraph,
  };
}
