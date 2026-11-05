export type EvidenceCase = {
  id: string;
  title: string;
  input_sha256: string;
  run_id: string;
  run_path: string;
  scenario_path: string;
  report_path: string;
  equation: string;
  outcome: string;
};

export type EvidenceIndex = {
  version: string;
  manifest_path: string;
  receipt_path: string;
  cases: EvidenceCase[];
};

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('The evidence index must contain objects.');
  return value as Record<string, unknown>;
}

/** Check downloaded evidence metadata before it reaches links and rendering. */
export function evidenceIndex(value: unknown, version: string): EvidenceIndex {
  const index = record(value);
  if (index.version !== version || !Array.isArray(index.cases) || index.cases.length !== 3)
    throw new Error('Evidence version does not match this build. Use the versioned source packet.');
  if (typeof index.manifest_path !== 'string' || typeof index.receipt_path !== 'string')
    throw new Error('Evidence index paths must be text.');
  for (const entry of index.cases) {
    const item = record(entry);
    for (const key of [
      'id',
      'title',
      'input_sha256',
      'run_id',
      'run_path',
      'scenario_path',
      'report_path',
      'equation',
      'outcome',
    ])
      if (typeof item[key] !== 'string') throw new Error(`Evidence case ${key} must be text.`);
  }
  return index as EvidenceIndex;
}
