import { lazy, Suspense, useEffect, useState } from 'react';
import { lessonNavigation } from './curriculum';
import { VisitReviews } from './visit-reviews';

const LegacyCourse = lazy(() => import('./Course').then((m) => ({ default: m.Course })));
const InfrastructureCourse = lazy(() =>
  import('./infrastructure/InfrastructureCourse').then((m) => ({
    default: m.InfrastructureCourse,
  })),
);
const route = () => new URLSearchParams(window.location.search).get('lesson') || 'power-energy';
export function CourseRouter() {
  const [id, setId] = useState(route);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  useEffect(() => {
    const update = () => {
      setId(route());
    };
    window.addEventListener('popstate', update);
    return () => {
      window.removeEventListener('popstate', update);
    };
  }, []);
  return (
    <VisitReviews.Provider value={{ reviewedIds, setReviewedIds }}>
      <Suspense fallback={<p role="status">Loading lesson…</p>}>
        {lessonNavigation(id)?.renderer === 'infrastructure' ? (
          <InfrastructureCourse key={id} lessonId={id} />
        ) : (
          <LegacyCourse />
        )}
      </Suspense>
    </VisitReviews.Provider>
  );
}
