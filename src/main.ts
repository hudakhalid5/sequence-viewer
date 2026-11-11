// 1. Imports and styles
import {
  drawSequence,
  drawAlignment,
  drawSequenceOverview,
  exampleAlignment,
  type AlignedSequence,
} from "./plot";

import "bootstrap/dist/css/bootstrap.min.css";
import "./style.css";

// 2. Parse multi-FASTA records
// Each FASTA header starts a new record; sequence lines are concatenated.
function parseFasta(text: string): AlignedSequence[] {
  const sequences: AlignedSequence[] = [];

  let currentName = "";
  let currentSequence = "";

  for (const line of text.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (trimmedLine === "") {
      continue;
    }

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

  if (currentName !== "") {
    sequences.push({
      name: currentName,
      sequence: currentSequence,
    });
  }

  return sequences;
}

// 3. Alignment state
// Used by Show Alignment; falls back to exampleAlignment when empty.
let uploadedAlignment: AlignedSequence[] = [];

// 4. Build the user interface
const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  app.innerHTML = `
    <main class="container py-5">

      <h1 class="text-primary">Interactive Sequence Viewer</h1>

      <p class="text-muted">
        Interactive visualization of nucleotide sequences
      </p>

      <!-- FASTA file upload -->
      <div class="mb-3">
        <label for="sequence-file" class="form-label">
          Upload a FASTA file
        </label>

        <input
          type="file"
          id="sequence-file"
          class="form-control"
          accept=".fasta,.fa,.fna,.txt"
        />
      </div>

      <!-- Manual sequence input -->
      <div class="mb-3">
        <label for="sequence-input" class="form-label">
          Input Sequence
        </label>

        <textarea
          id="sequence-input"
          class="form-control"
          rows="4"
          placeholder="Example: ATGCCATGAACTG"
        ></textarea>
      </div>

      <!-- Plot and Clear buttons -->
      <!-- Sequence testing and plotting buttons -->
<div class="d-flex gap-2 flex-wrap mb-3">
  <button
    id="load-example-button"
    class="btn btn-primary"
    type="button"
  >
    Load Example
  </button>

  <button
    id="plot-button"
    class="btn btn-primary"
    type="button"
  >
    Plot Sequence
  </button>

  <button
    id="clear-button"
    class="btn btn-primary"
    type="button"
  >
    Clear
  </button>
</div>

<!-- Multiple-sequence alignment button -->
<div class="mb-3">
  <button
    id="alignment-button"
    class="btn btn-primary"
    type="button"
  >
    Show Alignment
  </button>
</div>
      <!-- Sequence validation messages -->
      <p id="sequence-info" class="mt-3 text-secondary"></p>

      <!-- Container for the D3 visualization -->
      <div id="sequence-plot" class="mt-4"></div>

    </main>
  `;
}

// 5. Select interface elements
const sequenceInput =
  document.querySelector<HTMLTextAreaElement>("#sequence-input");

const loadExampleButton = document.querySelector<HTMLButtonElement>(
  "#load-example-button",
);
const sequenceFile = document.querySelector<HTMLInputElement>("#sequence-file");

const plotButton = document.querySelector<HTMLButtonElement>("#plot-button");

const clearButton = document.querySelector<HTMLButtonElement>("#clear-button");

const sequenceInfo =
  document.querySelector<HTMLParagraphElement>("#sequence-info");

const sequencePlot = document.querySelector<HTMLDivElement>("#sequence-plot");

// Load the saved Human HBB sequence into the textarea
if (loadExampleButton && sequenceInput) {
  loadExampleButton.addEventListener("click", () => {
    const humanHBB = exampleAlignment.find((record) => record.name === "Human");

    if (!humanHBB) {
      return;
    }

    // Remove alignment gaps and whitespace
    sequenceInput.value = humanHBB.sequence.replace(/[-\s]/g, "");

    // Reset any previously uploaded alignment
    uploadedAlignment = [];

    if (sequenceFile) {
      sequenceFile.value = "";
    }

    sequencePlot?.replaceChildren();

    if (sequenceInfo) {
      sequenceInfo.textContent =
        "Human HBB example loaded. Click Plot Sequence.";
    }
  });
}
// 6. Validate and plot a nucleotide sequence
if (sequenceInput && plotButton && sequenceInfo) {
  plotButton.addEventListener("click", () => {
    // Normalize manual input before validating A/C/G/T/U.
    const sequence = sequenceInput.value.toUpperCase().replace(/\s/g, "");

    if (sequence.length === 0) {
      sequenceInfo.textContent = "Please enter a sequence.";
      sequencePlot?.replaceChildren();
      return;
    }

    if (!/^[ACGTU]+$/.test(sequence)) {
      sequenceInfo.textContent =
        "Invalid sequence: Allowed characters are A, C, G, T or U.";

      sequencePlot?.replaceChildren();
      return;
    }

    sequenceInfo.textContent = `Valid sequence: ${sequence.length} nucleotides`;

    drawSequence(sequence);
  });
}

// 7. Read and validate an uploaded FASTA file
if (sequenceFile && sequenceInput) {
  sequenceFile.addEventListener("change", async () => {
    const file = sequenceFile.files?.[0];

    if (!file) {
      return;
    }

    const content = await file.text();

    const parsedSequences = parseFasta(content);

    console.log("Parsed FASTA sequences:", parsedSequences);

    if (parsedSequences.length === 0) {
      uploadedAlignment = [];

      if (sequenceInfo) {
        sequenceInfo.textContent =
          "Invalid FASTA file: no sequence records were found.";
      }

      return;
    }

    const emptyRecord = parsedSequences.find(
      (record) => record.sequence.length === 0,
    );

    if (emptyRecord) {
      uploadedAlignment = [];

      if (sequenceInfo) {
        sequenceInfo.textContent = `Invalid FASTA file: "${emptyRecord.name}" has an empty sequence.`;
      }

      return;
    }
    uploadedAlignment = parsedSequences;

    const invalidRecord = parsedSequences.find(
      (record) => !/^[ACGTUN-]+$/.test(record.sequence),
    );

    if (invalidRecord) {
      uploadedAlignment = [];

      if (sequenceInfo) {
        sequenceInfo.textContent = `Invalid FASTA file: "${invalidRecord.name}" contains unsupported characters.`;
      }

      return;
    }

    // An aligned FASTA must contain sequences of equal length.
    const expectedLength = parsedSequences[0].sequence.length;

    const unequalRecord = parsedSequences.find(
      (record) => record.sequence.length !== expectedLength,
    );

    if (unequalRecord) {
      uploadedAlignment = [];

      if (sequenceInfo) {
        sequenceInfo.textContent = `Invalid alignment: "${unequalRecord.name}" has ${unequalRecord.sequence.length} positions; expected ${expectedLength}.`;
      }

      return;
    }

    // Show a single record in the textarea; keep multi-FASTA in memory.
    if (parsedSequences.length === 1) {
      sequenceInput.value = parsedSequences[0].sequence;
    } else {
      sequenceInput.value = "";
    }
  });
}

// 8. Clear inputs and visualization
if (clearButton && sequenceInput && sequenceFile && sequenceInfo) {
  clearButton.addEventListener("click", () => {
    sequenceInput.value = "";

    sequenceFile.value = "";

    uploadedAlignment = [];

    sequenceInfo.textContent = "";

    sequencePlot?.replaceChildren();
  });
}

// 9. Display uploaded or example alignment
const alignmentButton =
  document.querySelector<HTMLButtonElement>("#alignment-button");

if (alignmentButton) {
  alignmentButton.addEventListener("click", () => {
    const sequences =
      uploadedAlignment.length > 0 ? uploadedAlignment : exampleAlignment;

    drawAlignment(sequences);
    drawSequenceOverview(sequences);
  });
}
