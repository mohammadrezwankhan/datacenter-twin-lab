import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { lessons } from './course-lessons';
import { RESEARCH_STUDIES } from './research/types';
import './curriculum-tracks.css';

export type CurriculumTrackId = 'foundations' | 'facility' | 'power-dynamics';

type CurriculumTracksProps = {
  /** Track containing the page currently shown. Selecting a tab only changes the choices below it. */
  activeTrack?: CurriculumTrackId;
};

const trackDetails: Record<
  CurriculumTrackId,
  { title: string; summary: string; description: string }
> = {
  foundations: {
    title: 'Foundations',
    summary: 'Lessons 1–5',
    description: 'Build the basics of energy, losses, reserve and backup sequence.',
  },
  facility: {
    title: 'Facility Architecture',
    summary: 'Lessons 6–12',
    description: 'Trace facility paths, shared risks, recovery and planning at scale.',
  },
  'power-dynamics': {
    title: 'Power Dynamics & Transients',
    summary: 'EMT + 5 studies',
    description: 'Explore electromagnetic transients and five numerical power-system studies.',
  },
};

const trackOrder: CurriculumTrackId[] = ['foundations', 'facility', 'power-dynamics'];
const trackLessonIds: Record<'foundations' | 'facility', readonly string[]> = {
  foundations: lessons.slice(0, 5).map((lesson) => lesson.id),
  facility: lessons.slice(5, 12).map((lesson) => lesson.id),
};

export function trackForLesson(lessonId: string): Exclude<CurriculumTrackId, 'power-dynamics'> {
  return trackLessonIds.foundations.includes(lessonId) ? 'foundations' : 'facility';
}

function lessonRouteChoices(trackId: 'foundations' | 'facility') {
  const start = trackId === 'foundations' ? 0 : 5;
  const count = trackId === 'foundations' ? 5 : 7;
  return lessons.slice(start, start + count).map((lesson, offset) => ({
    href: `?lesson=${encodeURIComponent(lesson.id)}`,
    label: `Lesson ${start + offset + 1} · ${lesson.title.replace(/^\d+\.\s*/, '')}`,
  }));
}

function routeChoices(trackId: CurriculumTrackId) {
  if (trackId !== 'power-dynamics') return lessonRouteChoices(trackId);
  return [
    { href: '?mode=emt', label: 'EMT · Electromagnetic transients' },
    ...RESEARCH_STUDIES.map((study) => ({
      href: `?study=${encodeURIComponent(study.id)}`,
      label: study.shortName,
    })),
  ];
}

export function CurriculumTracks({ activeTrack = 'foundations' }: CurriculumTracksProps) {
  const [selectedTrack, setSelectedTrack] = useState(activeTrack);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => setSelectedTrack(activeTrack), [activeTrack]);

  function selectTrack(trackId: CurriculumTrackId, focus = false) {
    setSelectedTrack(trackId);
    if (focus) {
      const index = trackOrder.indexOf(trackId);
      tabRefs.current[index]?.focus();
    }
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = trackOrder.indexOf(selectedTrack);
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % trackOrder.length;
    if (event.key === 'ArrowLeft')
      nextIndex = (currentIndex + trackOrder.length - 1) % trackOrder.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = trackOrder.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectTrack(trackOrder[nextIndex], true);
  }

  const currentDetails = trackDetails[selectedTrack];

  return (
    <section className="curriculum-tracks" aria-labelledby="curriculum-tracks-title">
      <div className="curriculum-tracks-heading">
        <span className="curriculum-tracks-eyebrow">LEARNING PATHS</span>
        <h2 id="curriculum-tracks-title">Choose a track</h2>
        <p id="curriculum-tracks-help">Follow the lesson sequence or jump directly to any study.</p>
      </div>
      <div
        className="curriculum-track-tabs"
        role="tablist"
        aria-label="Curriculum tracks"
        aria-describedby="curriculum-tracks-help"
      >
        {trackOrder.map((trackId, index) => {
          const details = trackDetails[trackId];
          const isSelected = selectedTrack === trackId;
          return (
            <button
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              className={`curriculum-track-tab${isSelected ? ' is-selected' : ''}`}
              data-track={trackId}
              id={`curriculum-tab-${trackId}`}
              key={trackId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls="curriculum-track-panel"
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectTrack(trackId)}
              onKeyDown={onTabKeyDown}
            >
              <span className="curriculum-track-tab-title">{details.title}</span>
              <span className="curriculum-track-tab-summary">{details.summary}</span>
            </button>
          );
        })}
      </div>
      <div
        className="curriculum-track-panel"
        data-track={selectedTrack}
        id="curriculum-track-panel"
        role="tabpanel"
        aria-labelledby={`curriculum-tab-${selectedTrack}`}
        tabIndex={0}
      >
        <div className="curriculum-track-panel-copy">
          <h3>{currentDetails.title}</h3>
          <p>{currentDetails.description}</p>
        </div>
        <nav
          className="curriculum-track-routes"
          aria-label={`${currentDetails.title} lessons and studies`}
        >
          {routeChoices(selectedTrack).map((choice) => (
            <a href={choice.href} key={choice.href}>
              {choice.label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
