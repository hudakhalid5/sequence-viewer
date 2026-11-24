import type { AlignedSequence } from "./alignment";
import { exampleAlignment, exampleRiboSeq } from "./examples";
import { readAlignedFasta } from "./fasta";
import { drawAlignment, drawSequence } from "./plot";

import "bootstrap/dist/css/bootstrap.min.css";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  setupViewer(app);
}

// Mount the viewer and connect its controls to upload state and rendering.
function setupViewer(app: HTMLDivElement): void {
  app.innerHTML = `
    <main class="container py-5">

      <h1 class="text-primary">Interactive Sequence Viewer</h1>

      <p class="text-muted">
        Interactive visualization of nucleotide sequences
      </p>

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

      <div class="d-flex gap-2 flex-wrap mb-3">
        <button id="plot-button" class="btn btn-primary" type="button">
          Plot Sequence
        </button>
        <button id="load-example-button" class="btn btn-outline-secondary" type="button">
          Load Example
        </button>
        <button id="clear-button" class="btn btn-outline-secondary" type="button">
          Clear
        </button>
      </div>

      <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
        <button
          id="alignment-button"
          class="btn btn-primary"
          type="button"
          aria-describedby="alignment-source"
        >
          Show Alignment
        </button>
        <span id="alignment-source" class="small text-body-secondary" role="status"></span>
      </div>
      <p id="sequence-info" class="mt-3 text-secondary"></p>

      <div
        id="sequence-plot"
        class="mt-4"
        role="region"
        aria-label="Sequence visualization"
        tabindex="0"
      ></div>

    </main>
  `;

  let uploadedAlignment: AlignedSequence[] = [];
  // Track the latest file selection so a reset can invalidate a pending read.
  let latestUpload = 0;

  const sequenceInput =
    app.querySelector<HTMLTextAreaElement>("#sequence-input");

  const loadExampleButton = app.querySelector<HTMLButtonElement>(
    "#load-example-button",
  );
  const sequenceFile = app.querySelector<HTMLInputElement>("#sequence-file");

  const plotButton = app.querySelector<HTMLButtonElement>("#plot-button");

  const clearButton = app.querySelector<HTMLButtonElement>("#clear-button");

  const sequenceInfo =
    app.querySelector<HTMLParagraphElement>("#sequence-info");

  const sequencePlot = app.querySelector<HTMLDivElement>("#sequence-plot");
  const alignmentButton =
    app.querySelector<HTMLButtonElement>("#alignment-button");

  const alignmentSource = app.querySelector("#alignment-source");

  // Update the stored records and the source label together.
  function setUploadedAlignment(sequences: AlignedSequence[]): void {
    uploadedAlignment = sequences;
    if (alignmentSource) {
      alignmentSource.textContent =
        sequences.length > 0 ? "Source: uploaded FASTA" : "";
    }
  }

  // Load the Human example into the single-sequence input.
  if (loadExampleButton && sequenceInput) {
    loadExampleButton.addEventListener("click", () => {
      const humanHBB = exampleAlignment.find((record) => record.name === "Human");

      if (!humanHBB) {
        return;
      }

      // The single-sequence plot expects an ungapped sequence.
      sequenceInput.value = humanHBB.sequence.replace(/[-\s]/g, "");

      latestUpload++;
      setUploadedAlignment([]);

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
  // Normalize and validate the textarea value before plotting.
  if (sequenceInput && plotButton && sequenceInfo) {
    plotButton.addEventListener("click", () => {
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

  // Read and validate the selected FASTA before making it available to plot.
  if (sequenceFile && sequenceInput) {
    sequenceFile.addEventListener("change", handleFastaUpload);

    async function handleFastaUpload() {
      const uploadId = ++latestUpload;
      const file = sequenceFile?.files?.[0];

      if (!file || !sequenceInput) {
        return;
      }

      let content: string;
      try {
        content = await file.text();
      } catch {
        if (uploadId === latestUpload) {
          setUploadedAlignment([]);
          if (sequenceInfo) {
            sequenceInfo.textContent = "Could not read the selected FASTA file.";
          }
        }
        return;
      }

      // A newer file selection or a reset can happen while the read is pending.
      if (uploadId !== latestUpload) {
        return;
      }

      const result = readAlignedFasta(content);
      if ("error" in result) {
        setUploadedAlignment([]);
        if (sequenceInfo) {
          sequenceInfo.textContent = result.error;
        }
        return;
      }

      // Show one uploaded record in the textarea. Multiple records go to the alignment view.
      setUploadedAlignment(result.sequences);
      sequenceInput.value =
        result.sequences.length === 1 ? result.sequences[0].sequence : "";
    }
  }

  // Reset the inputs and output. Advancing the upload ID invalidates pending reads.
  if (clearButton && sequenceInput && sequenceFile && sequenceInfo) {
    clearButton.addEventListener("click", () => {
      sequenceInput.value = "";

      sequenceFile.value = "";

      latestUpload++;
      setUploadedAlignment([]);

      sequenceInfo.textContent = "";

      sequencePlot?.replaceChildren();
    });
  }

  // Prefer the uploaded alignment. The dummy Ribo-seq track belongs to the built-in example.
  if (alignmentButton) {
    alignmentButton.addEventListener("click", () => {
      if (uploadedAlignment.length > 0) {
        drawAlignment(uploadedAlignment);
      } else {
        drawAlignment(exampleAlignment, exampleRiboSeq);
      }
    });
  }
}
