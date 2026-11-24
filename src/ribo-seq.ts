export type RiboSeqTrack = {
  referenceName: string;
  counts: readonly number[];
};

// Generate reproducible demo counts, including zero-count bases.
export function createDummyRiboSeq(alignedReference: string): number[] {
  const length = alignedReference.replace(/-/g, "").length;
  let seed = 42;

  return Array.from({ length }, () => {
    // Advance a fixed seed so the demo looks the same each time.
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const sample = seed / 2 ** 32;

    // Give zero a higher chance so some stretches have no visible bars.
    return Math.max(0, Math.floor(sample * 25) - 5);
  });
}

export function mapRiboSeqToColumns(
  alignedReference: string,
  counts: readonly number[],
): { column: number; count: number }[] {
  const bars: { column: number; count: number }[] = [];
  let baseIndex = 0;

  // Visit every alignment column, but take the next count only at a base.
  // For A-CG and counts [5, 12, 8], the plot shows 5, a blank, 12, then 8.
  for (let column = 0; column < alignedReference.length; column++) {
    if (alignedReference[column] === "-") continue;

    const count = counts[baseIndex++];
    // A zero count is valid. Only a missing count is skipped.
    if (count !== undefined) bars.push({ column, count });
  }

  return bars;
}
