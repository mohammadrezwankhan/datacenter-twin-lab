import { requiredValue, requiredPresent } from './required-value';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  trackLessons,
  trackForLesson,
  type CurriculumTrackId,
  type LessonTrackId,
} from './curriculum';
import { RESEARCH_STUDIES } from './research/types';
import './curriculum-tracks.css';

export { trackForLesson };
export type { CurriculumTrackId };

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
  infrastructure: {
    title: 'Infrastructure Engineering',
    summary: 'Lessons 13–24',
    description:
      'Inspect source boundaries, cross-system capacity and unresolved engineering evidence.',
  },
  'power-dynamics': {
    title: 'Power Dynamics & Transients',
    summary: 'EMT + 5 studies',
    description: 'Explore electromagnetic transients and five numerical power-system studies.',
  },
};

const trackOrder: CurriculumTrackId[] = [
  'foundations',
  'facility',
  'power-dynamics',
  'infrastructure',
];

for (const track of ['foundations', 'facility', 'infrastructure'] as const) {
  const members = trackLessons(track);
  trackDetails[track].summary =
    `Lessons ${String(requiredValue(members[0], 'members[0]').number)}–${String(requiredPresent(members.at(-1), 'members.at(-1)').number)}`;
}
trackDetails['power-dynamics'].summary = `EMT + ${String(RESEARCH_STUDIES.length)} studies`;

function lessonRouteChoices(trackId: LessonTrackId) {
  return trackLessons(trackId).map((lesson) => ({
    href: `?lesson=${encodeURIComponent(lesson.id)}`,
    label: `Lesson ${String(lesson.number)} · ${lesson.title}`,
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

  useEffect(() => {
    setSelectedTrack(activeTrack);
  }, [activeTrack]);

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
    selectTrack(requiredValue(trackOrder[nextIndex], 'trackOrder[nextIndex]'), true);
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
              onClick={() => {
                selectTrack(trackId);
              }}
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
