import { useRef, type CSSProperties } from 'react';
import { lessons } from './course-lessons';
import { courseChapters, courseThemes } from './course-themes';
import './course-map.css';

type CourseMapProps = {
  selectedId: string;
  reviewedIds: readonly string[];
  onSelect: (id: string) => void;
};

const lessonStyle = (accent: string, softAccent: string) =>
  ({ '--lesson-accent': accent, '--lesson-soft-accent': softAccent }) as CSSProperties;

export function CourseMap({ selectedId, reviewedIds, onSelect }: CourseMapProps) {
  const atlas = useRef<HTMLDetailsElement | null>(null);
  const choose = (id: string) => {
    if (atlas.current) atlas.current.open = false;
    onSelect(id);
  };
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedId) ?? lessons[0];
  const selectedIndex = lessons.indexOf(selectedLesson);
  const selectedTheme = courseThemes[selectedLesson.id];
  const reviewed = new Set(reviewedIds);
  const reviewedCount = lessons.filter((lesson) => reviewed.has(lesson.id)).length;
  const chapterIndex = courseChapters.findIndex((chapter) =>
    chapter.lessonIds.some((id: string) => id === selectedLesson.id),
  );

  return (
    <section className="course-map" aria-label="Course map">
      <div
        className="course-map-current"
        style={lessonStyle(selectedTheme.accent, selectedTheme.softAccent)}
      >
        <div className="course-map-current-copy">
          <span className="course-map-kicker">Datacenter Twin Lab · course atlas</span>
          <div className="course-map-current-meta">
            <span>
              Chapter {String(chapterIndex + 1).padStart(2, '0')} / {courseChapters.length}
            </span>
            <span>
              Lesson {String(selectedIndex + 1).padStart(2, '0')} / {lessons.length}
            </span>
          </div>
        </div>
        <div className="course-map-current-tools">
          <label className="course-map-select-label">
            Choose a lesson
            <select value={selectedLesson.id} onChange={(event) => choose(event.target.value)}>
              {lessons.map((lesson) => (
                <option value={lesson.id} key={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>
          </label>
          <p
            className="course-map-reviewed"
            aria-label={`${reviewedCount} lessons self-marked as reviewed in this visit`}
          >
            <span className="course-map-reviewed-count">
              {reviewedCount} / {lessons.length}
            </span>
            <span>
              Reviewed in this visit
              <small>Self-marked for this session</small>
            </span>
          </p>
        </div>
      </div>

      <details className="course-map-disclosure" ref={atlas}>
        <summary>
          <span>Explore all 12 lessons</span>
          <span className="course-map-summary-note">4 chapters · choose any lesson</span>
        </summary>
        <div className="course-map-chapters">
          {courseChapters.map((chapter, index) => {
            const chapterLessons = chapter.lessonIds
              .map((id) => lessons.find((lesson) => lesson.id === id))
              .filter((lesson) => lesson !== undefined);

            return (
              <section
                className="course-map-chapter"
                key={chapter.title}
                aria-label={chapter.title}
              >
                <div className="course-map-chapter-heading">
                  <span>0{index + 1}</span>
                  <h3>{chapter.title}</h3>
                  <small>{chapterLessons.length} lessons</small>
                </div>
                <div className="course-map-grid">
                  {chapterLessons.map((lesson) => {
                    const lessonIndex = lessons.indexOf(lesson);
                    const theme = courseThemes[lesson.id];
                    const isSelected = lesson.id === selectedLesson.id;
                    const isReviewed = reviewed.has(lesson.id);

                    return (
                      <button
                        className={`course-map-card${isSelected ? ' is-current' : ''}${isReviewed ? ' is-reviewed' : ''}`}
                        type="button"
                        key={lesson.id}
                        style={lessonStyle(theme.accent, theme.softAccent)}
                        aria-label={`Open lesson ${lessonIndex + 1}: ${theme.shortTitle}`}
                        aria-current={isSelected ? 'step' : undefined}
                        onClick={() => choose(lesson.id)}
                      >
                        <span className="course-map-card-top">
                          <span className="course-map-glyph" aria-hidden="true">
                            {theme.glyph}
                          </span>
                          <span className="course-map-card-number">
                            {String(lessonIndex + 1).padStart(2, '0')}
                          </span>
                          {isReviewed && (
                            <span className="course-map-card-reviewed">
                              <span aria-hidden="true">✓</span> Reviewed
                            </span>
                          )}
                        </span>
                        <strong>{theme.shortTitle}</strong>
                        <span className="course-map-card-objective">{theme.objective}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <p className="course-map-note">
          Reviewed marks are self-marked for this visit and are kept in session memory; they are not
          scores or certification.
        </p>
      </details>
    </section>
  );
}
