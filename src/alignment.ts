export type AlignedSequence = {
  name: string;
  sequence: string;
};

export type ColumnCategory = "gapped" | "ambiguous" | "variable" | "conserved";

export type AlignmentColumn = {
  category: ColumnCategory;
  gapCount: number;
};

// Assign one category per column in priority order: gapped, ambiguous, variable, conserved.
// Count gap characters separately because one gapped column can contain several gaps.
export function classifyColumn(bases: readonly string[]): AlignmentColumn {
  const gapCount = bases.filter((base) => base === "-").length;

  if (gapCount > 0) return { category: "gapped", gapCount };
  if (bases.includes("N")) return { category: "ambiguous", gapCount };
  if (new Set(bases).size > 1) return { category: "variable", gapCount };
  return { category: "conserved", gapCount };
}
