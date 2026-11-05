import { requiredValue } from '../../required-value';
import type { SceneProps } from './types';
import { numberOutput } from './types';
import { SceneDiagram } from './primitives';

export default function GroundingScene({ result, step }: SceneProps) {
  const rows = [
    {
      label: 'THD denominator · fundamental current',
      value: numberOutput(result, 'thdPercent', '%', 1),
    },
    {
      label: 'TDD denominator · reference current',
      value: numberOutput(result, 'tddPercent', '%', 1),
    },
    {
      label: 'Ground-potential rise screen',
      value: numberOutput(result, 'groundPotentialRiseV', 'V', 1),
    },
    { label: 'DC outgoing + return loss', value: numberOutput(result, 'dcDropV', 'V', 2) },
  ];
  const story = [
    'Neutral grounding, protective bonding and signal interfaces use separate conductors.',
    'Ground-potential rise is an electrical result, not a human exposure limit.',
    'The harmonic bars are schematic; THD and TDD readouts use the completed input values.',
    'The DC route includes both outgoing and return conductors.',
  ][step];
  return (
    <SceneDiagram
      id="grounding"
      title="Grounding, power quality and return path"
      description={requiredValue(story, 'scene storyboard step')}
      rows={rows}
      flat={false}
    >
      <rect x="76" y="115" width="318" height="214" rx="10" fill="#132632" stroke="#3b5362" />
      <text x="98" y="146" fill="#edf4fa" fontSize="16" fontWeight="700">
        Illustrative spectrum · same bars
      </text>
      {[30, 54, 76, 96, 119, 142].map((height, index) => (
        <g key={index}>
          <rect
            x={108 + index * 40}
            y={282 - height}
            width="22"
            height={height}
            rx="3"
            fill={index < 2 ? '#69d8d3' : '#83bcff'}
            opacity=".85"
          />
          <text x={119 + index * 40} y="304" textAnchor="middle" fill="#a0b1c3" fontSize="11">
            H{index + 1}
          </text>
        </g>
      ))}
      <text x="117" y="324" fill="#a0b1c3" fontSize="12">
        THD / fundamental
      </text>
      <text x="276" y="324" fill="#a0b1c3" fontSize="12">
        TDD / reference
      </text>
      <path d="M484 160H870" stroke="#69d8d3" strokeWidth="4" />
      <text x="677" y="144" textAnchor="middle" fill="#8df0cd" fontSize="15">
        Protective bonding
      </text>
      <path d="M484 206H870" stroke="#ffd17e" strokeWidth="4" strokeDasharray="7 6" />
      <text x="677" y="193" textAnchor="middle" fill="#ffe0a0" fontSize="15">
        Neutral grounding
      </text>
      <path d="M484 252H870" stroke="#c0a5ff" strokeWidth="4" strokeDasharray="2 7" />
      <text x="677" y="239" textAnchor="middle" fill="#d4c5ff" fontSize="15">
        Signal reference interface
      </text>
      <path d="M565 295H851V355H565Z" fill="none" stroke="#ff9e8b" strokeWidth="3" />
      <path d="M565 295H851" stroke="#ff9e8b" strokeWidth="4" />
      <path d="M851 355H565" stroke="#ff9e8b" strokeWidth="4" strokeDasharray="8 5" />
      <text x="707" y="286" textAnchor="middle" fill="#ffb4a7" fontSize="13">
        DC outgoing
      </text>
      <text x="707" y="379" textAnchor="middle" fill="#ffb4a7" fontSize="13">
        DC return · same route length
      </text>
      {step >= 1 && (
        <g>
          <circle cx="452" cy="372" r="21" fill="#302427" stroke="#ff9e8b" strokeWidth="3" />
          <path d="M435 387l34-31" stroke="#ffb4a7" strokeWidth="2" />
          <text x="451" y="410" textAnchor="middle" fill="#ffb4a7" fontSize="12">
            GPR result
          </text>
        </g>
      )}
    </SceneDiagram>
  );
}
