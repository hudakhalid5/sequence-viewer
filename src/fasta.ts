import type { AlignedSequence } from "./alignment";

// Each FASTA header starts a record whose sequence can span multiple lines.
function parseFasta(text: string): AlignedSequence[] {
  const sequences: AlignedSequence[] = [];

  let currentName = "";
  let currentSequence = "";

  for (const line of text.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (trimmedLine === "") {
      continue;
    }

    // A new header ends the previous record and starts the next one.
    if (trimmedLine.startsWith(">")) {
      if (currentName !== "") {
        sequences.push({
          name: currentName,
          sequence: currentSequence,
        });
      }

      currentName = trimmedLine.slice(1).trim();
      currentSequence = "";
    } else {
      currentSequence += trimmedLine.toUpperCase();
    }
  }

  // The final record has no following header to trigger a save.
  if (currentName !== "") {
    sequences.push({
      name: currentName,
      sequence: currentSequence,
    });
  }

  return sequences;
}

// Return validated records or a message the viewer can show beside the inputs.
export function readAlignedFasta(
  text: string,
): { sequences: AlignedSequence[] } | { error: string } {
  const sequences = parseFasta(text);

  if (sequences.length === 0) {
    return { error: "Invalid FASTA file: no sequence records were found." };
  }

  const emptyRecord = sequences.find((record) => record.sequence.length === 0);
  if (emptyRecord) {
    return {
      error: `Invalid FASTA file: "${emptyRecord.name}" has an empty sequence.`,
    };
  }

  const invalidRecord = sequences.find(
    (record) => !/^[ACGTUN-]+$/.test(record.sequence),
  );
  if (invalidRecord) {
    return {
      error: `Invalid FASTA file: "${invalidRecord.name}" contains unsupported characters.`,
    };
  }

  // Equal lengths let the renderer compare the same column across all records.
  const expectedLength = sequences[0].sequence.length;
  const unequalRecord = sequences.find(
    (record) => record.sequence.length !== expectedLength,
  );
  if (unequalRecord) {
    return {
      error: `Invalid alignment: "${unequalRecord.name}" has ${unequalRecord.sequence.length} positions; expected ${expectedLength}.`,
    };
  }

  return { sequences };
}
