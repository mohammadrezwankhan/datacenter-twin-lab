const { default: catalog } = await import('./course-catalog.json', { with: { type: 'json' } });

export type LessonTrackId = 'foundations' | 'facility' | 'infrastructure';
export type CurriculumTrackId = LessonTrackId | 'power-dynamics';
export type LessonNavigation = {
  id: string;
  number: number;
  title: string;
  trackId: LessonTrackId;
  renderer: 'legacy' | 'infrastructure';
  readingRoute: string;
  prerequisites: readonly string[];
};
export const courseCatalog = catalog as readonly LessonNavigation[];
export const courseTotal = courseCatalog.length;
export const lessonNavigation = (id: string) => courseCatalog.find((item) => item.id === id);
export const trackLessons = (id: LessonTrackId) =>
  courseCatalog.filter((item) => item.trackId === id);
export const trackForLesson = (id: string): LessonTrackId =>
  lessonNavigation(id)?.trackId ?? 'foundations';
export const relatedInfrastructure = (id: string) =>
  courseCatalog.filter(
    (item) => item.renderer === 'infrastructure' && item.prerequisites.includes(id),
  );
export function navigateLesson(id: string) {
  if (!lessonNavigation(id)) return;
  const url = new URL(window.location.href);
  if (
    url.searchParams.get('lesson') === id &&
    !url.searchParams.has('study') &&
    !url.searchParams.has('mode')
  )
    return;
  url.hash = '';
  url.searchParams.delete('view');
  url.searchParams.delete('study');
  url.searchParams.delete('mode');
  url.searchParams.set('lesson', id);
  window.history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
