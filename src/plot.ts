import * as d3 from "d3";
import {
  classifyColumn,
  type AlignedSequence,
  type AlignmentColumn,
  type ColumnCategory,
} from "./alignment";

import { mapRiboSeqToColumns, type RiboSeqTrack } from "./ribo-seq";

// Render one nucleotide sequence and its zoomable position axis.
export function drawSequence(sequence: string): void {
  const sequenceLength = sequence.length;
  const nucleotides = sequence.split("");

  const nucleotideColors: Record<string, string> = {
    A: "#198754", // Green
    T: "#dc3545", // Red
    U: "#dc3545", // Red (RNA)
    G: "#0d6efd", // Blue
    C: "#6f42c1", // Purple
  };

  // Map sequence boundaries and 1-based positions to SVG coordinates.
  const xScale = d3.scaleLinear().domain([0, sequenceLength]).range([20, 580]);

  const positionScale = d3
    .scaleLinear()
    .domain([0.5, sequenceLength + 0.5])
    .range([20, 580]);

  const container = d3.select("#sequence-plot");
  container.selectAll("*").remove();

  const svg = container.append("svg").attr("width", 600).attr("height", 100);

  svg
    .append("defs")
    .append("clipPath")
    .attr("id", "sequence-clip")
    .append("rect")
    .attr("x", 20)
    .attr("y", 35)
    .attr("width", 560)
    .attr("height", 25);

  svg
    .append("rect")
    .attr("x", 20)
    .attr("y", 35)
    .attr("width", 560)
    .attr("height", 25)
    .attr("fill", "#eef4fa");

  // Clip nucleotide markers and letters to the visible track.
  const sequenceGroup = svg
    .append("g")
    .attr("clip-path", "url(#sequence-clip)");

  // Draw nucleotide boundaries; display letters only if space permits.
  const positions = d3.range(sequenceLength + 1);

  sequenceGroup
    .selectAll(".nucleotide-marker")
    .data(positions)
    .join("line")
    .attr("class", "nucleotide-marker")
    .attr("x1", (d) => xScale(d))
    .attr("x2", (d) => xScale(d))
    .attr("y1", 35)
    .attr("y2", 60)
    .attr("stroke", "#b8c7d9")
    .attr("stroke-width", 1);

  const nucleotideWidth = 560 / sequenceLength;

  if (nucleotideWidth >= 16) {
    sequenceGroup
      .selectAll(".nucleotide-letter")
      .data(nucleotides)
      .join("text")
      .attr("class", "nucleotide-letter")
      .attr("x", (_d, i) => xScale(i + 0.5))
      .attr("y", 52)
      .attr("text-anchor", "middle")
      .attr("font-family", "monospace")
      .attr("font-size", 14)
      .attr("font-weight", "bold")
      .attr("fill", (d) => nucleotideColors[d])
      .text((d) => d);
  }

  // Use all positions for short sequences, or approximately 10 ticks.
  const xAxis = d3
    .axisBottom(positionScale)
    .tickValues(
      sequenceLength <= 20
        ? d3.range(1, sequenceLength + 1)
        : d3.ticks(1, sequenceLength, 10).filter((d) => d >= 1),
    )
    .tickFormat((value) => String(Math.round(Number(value))));

  const axisGroup = svg
    .append("g")
    .attr("transform", "translate(0, 65)")
    .call(xAxis);

  // Zoom updates the position axis while keeping ticks within sequence bounds.
  const zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 100])
    .on("zoom", (event) => {
      const zoomedScale = event.transform.rescaleX(positionScale);

      const visiblePositions = zoomedScale.domain();

      const start = Math.max(1, Math.ceil(visiblePositions[0]));
      const end = Math.min(sequenceLength, Math.floor(visiblePositions[1]));

      const ticks =
        end - start <= 20
          ? d3.range(start, end + 1)
          : d3.ticks(start, end, 10).filter((d) => d >= 1);

      const zoomedAxis = d3
        .axisBottom(zoomedScale)
        .tickValues(ticks)
        .tickFormat((value) => String(Math.round(Number(value))));

      axisGroup.call(zoomedAxis);
    });

  svg.call(zoomBehavior);
}

const alignmentColors = {
  gap: "#1d4ed8",
  ambiguous: "#6b7280",
  variable: "#b91c1c",
  conserved: "#15803d",
  neutral: "#364152",
} as const;

// Give gaps and ambiguous bases their own colors in every column category.
function alignmentBaseColor(base: string, category: ColumnCategory): string {
  if (base === "-") return alignmentColors.gap;
  if (base === "N") return alignmentColors.ambiguous;
  if (category === "variable" || category === "conserved") {
    return alignmentColors[category];
  }
  return alignmentColors.neutral;
}

// Render the overview and wrapped grid from the same column classifications.
export function drawAlignment(
  sequences: readonly AlignedSequence[],
  riboSeq?: RiboSeqTrack,
): void {
  if (sequences.length === 0) {
    return;
  }

  const alignmentLength = sequences[0].sequence.length;

  if (sequences.some((item) => item.sequence.length !== alignmentLength)) {
    console.error("All aligned sequences must have the same length.");
    return;
  }

  const columns: AlignmentColumn[] = Array.from(
    { length: alignmentLength },
    (_, position) =>
      classifyColumn(sequences.map(({ sequence }) => sequence[position])),
  );

  d3.select("#sequence-plot").selectAll("*").remove();
  drawSequenceOverview(sequences, columns, riboSeq);
  drawAlignmentGrid(sequences, columns);
}

// Summarize alignment columns and render the sequence rows in wrapped blocks.
function drawAlignmentGrid(
  sequences: readonly AlignedSequence[],
  columns: AlignmentColumn[],
): void {
  const alignmentLength = columns.length;
  const counts: Record<ColumnCategory, number> = {
    conserved: 0,
    variable: 0,
    ambiguous: 0,
    gapped: 0,
  };
  let gapCount = 0;

  for (const { category, gapCount: columnGaps } of columns) {
    counts[category]++;
    gapCount += columnGaps;
  }

  const {
    conserved: conservedCount,
    variable: variableCount,
    ambiguous: ambiguousCount,
    gapped: gapColumnCount,
  } = counts;

  const conservationPercentage = (conservedCount / alignmentLength) * 100;
  const variablePercentage = (variableCount / alignmentLength) * 100;
  const ambiguousPercentage = (ambiguousCount / alignmentLength) * 100;
  const gapColumnPercentage = (gapColumnCount / alignmentLength) * 100;

  // Use all sequence characters as the denominator for individual gaps.
  const totalCharacters = sequences.length * alignmentLength;
  const gapPercentage = (gapCount / totalCharacters) * 100;

  const columnsPerBlock = 90;
  const numberOfBlocks = Math.ceil(alignmentLength / columnsPerBlock);

  const columnWidth = 12;
  const rowHeight = 28;
  const blockSpacing = 30;
  const topMargin = 140;

  // Truncate long labels to keep the sequence columns at a fixed offset.
  const leftMargin = 180;
  const labelFontSize = 13;
  const labelMaxWidth = leftMargin - 20;

  const measurementCanvas = document.createElement("canvas");
  const context = measurementCanvas.getContext("2d");

  if (context) {
    context.font = `${labelFontSize}px sans-serif`;
  }

  function truncateLabel(name: string): string {
    if (!context) return name;

    if (context.measureText(name).width <= labelMaxWidth) {
      return name;
    }

    let truncated = name;

    while (
      truncated.length > 0 &&
      context.measureText(truncated + "…").width > labelMaxWidth
    ) {
      truncated = truncated.slice(0, -1);
    }

    return truncated + "…";
  }
  const blockHeight = 25 + sequences.length * rowHeight + blockSpacing;

  const container = d3.select("#sequence-plot");

  const svg = container
    .append("svg")
    .attr("width", leftMargin + columnsPerBlock * columnWidth + 60)
    .attr("height", topMargin + numberOfBlocks * blockHeight);
  svg
    .append("rect")
    .attr("x", 10)
    .attr("y", 5)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", "#fde2e2")
    .attr("stroke", alignmentColors.variable);

  svg
    .append("text")
    .attr("x", 28)
    .attr("y", 15)
    .attr("font-size", 12)
    .attr("fill", "#364152")
    .text("Variable alignment column");

  svg
    .append("text")
    .attr("x", 250)
    .attr("y", 15)
    .attr("font-size", 12)
    .attr("fill", alignmentColors.gap)
    .text("Alignment gap (-)");

  svg
    .append("text")
    .attr("x", 410)
    .attr("y", 15)
    .attr("font-size", 12)
    .attr("fill", alignmentColors.conserved)
    .text("Conserved");

  svg
    .append("text")
    .attr("x", 500)
    .attr("y", 15)
    .attr("font-size", 12)
    .attr("fill", alignmentColors.ambiguous)
    .text("Ambiguous base (N)");

  svg
    .append("text")
    .attr("x", 640)
    .attr("y", 15)
    .attr("font-size", 12)
    .attr("fill", alignmentColors.neutral)
    .text("Known base in a gapped or ambiguous column");

  const statisticsLines = [
    `Conserved: ${conservedCount} / ${alignmentLength} (${conservationPercentage.toFixed(1)}%) | Variable: ${variableCount} / ${alignmentLength} (${variablePercentage.toFixed(1)}%)`,
    `Ambiguous (N): ${ambiguousCount} (${ambiguousPercentage.toFixed(1)}%) | Gap columns: ${gapColumnCount} (${gapColumnPercentage.toFixed(1)}%)`,
    `Total gaps: ${gapCount} (${gapPercentage.toFixed(1)}%)`,
  ];

  statisticsLines.forEach((line, index) => {
    svg
      .append("text")
      .attr("x", 10)
      .attr("y", 48 + index * 20)
      .attr("font-size", 13)
      .attr("font-weight", "bold")
      .attr("fill", "#364152")
      .text(line);
  });

  // Each block repeats the sequence labels for its slice of alignment columns.
  for (let blockIndex = 0; blockIndex < numberOfBlocks; blockIndex++) {
    const start = blockIndex * columnsPerBlock;
    const end = Math.min(start + columnsPerBlock, alignmentLength);

    const blockY = topMargin + blockIndex * blockHeight;

    svg
      .append("text")
      .attr("x", 10)
      .attr("y", blockY - 15)
      .attr("font-size", 12)
      .attr("font-weight", "bold")
      .attr("fill", "#6c757d")
      .text(`Alignment positions ${start + 1}–${end}`);

    for (let columnIndex = start; columnIndex < end; columnIndex++) {
      const localIndex = columnIndex - start;
      const x = leftMargin + localIndex * columnWidth;

      if (
        columnIndex === start ||
        (columnIndex + 1) % 10 === 0 ||
        columnIndex === end - 1
      ) {
        svg
          .append("text")
          .attr("x", x + columnWidth / 2)
          .attr("y", blockY)
          .attr("text-anchor", "middle")
          .attr("font-family", "monospace")
          .attr("font-size", 10)
          .text(columnIndex + 1);
      }
    }

    sequences.forEach((item, rowIndex) => {
      const y = blockY + 25 + rowIndex * rowHeight;

      svg
        .append("text")
        .attr("x", 10)
        .attr("y", y)
        .attr("font-size", labelFontSize)
        .attr("font-family", "sans-serif")
        .text(truncateLabel(item.name))
        .append("title")
        .text(item.name);

      for (let columnIndex = start; columnIndex < end; columnIndex++) {
        const nucleotide = item.sequence[columnIndex];
        const localIndex = columnIndex - start;
        const x = leftMargin + localIndex * columnWidth;

        const { category } = columns[columnIndex];
        const isVariable = category === "variable";

        if (isVariable) {
          svg
            .append("rect")
            .attr("x", x)
            .attr("y", y - 16)
            .attr("width", columnWidth)
            .attr("height", 20)
            .attr("fill", "#fde2e2");
        }

        svg
          .append("text")
          .attr("x", x + columnWidth / 2)
          .attr("y", y)
          .attr("text-anchor", "middle")
          .attr("font-family", "monospace")
          .attr("font-size", 14)
          .attr("font-weight", isVariable ? "bold" : "normal")
          .attr("fill", alignmentBaseColor(nucleotide, category))
          .text(nucleotide);
      }
    });
  }
}

// Draw the alignment overview and its optional Ribo-seq track on a shared axis.
function drawSequenceOverview(
  sequences: readonly AlignedSequence[],
  columns: AlignmentColumn[],
  riboSeq?: RiboSeqTrack,
): void {
  const alignmentLength = columns.length;

  const width = 800;
  const leftMargin = 150;
  const rightMargin = 30;
  const rowHeight = 40;
  const reference = sequences.find(
    ({ name }) => name === riboSeq?.referenceName,
  );
  // Map counts from ungapped reference positions to alignment columns.
  const signal =
    riboSeq && reference
      ? mapRiboSeqToColumns(reference.sequence, riboSeq.counts)
      : [];
  const signalTop = 38;
  const signalBottom = 144;
  const topMargin = signal.length > 0 ? signalBottom + 30 : 30;
  const height = topMargin + sequences.length * rowHeight + 40;

  // Map alignment column boundaries to pixels for both tracks.
  const xScale = d3
    .scaleLinear()
    .domain([0, alignmentLength])
    .range([leftMargin, width - rightMargin]);

  const svg = d3
    .select("#sequence-plot")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  svg
    .append("defs")
    .append("clipPath")
    .attr("id", "alignment-overview-clip")
    .append("rect")
    .attr("x", leftMargin)
    .attr("width", width - leftMargin - rightMargin)
    .attr("height", height);

  // Clip both tracks so zoomed marks cannot cover the sequence labels.
  const zoomGroup = svg
    .append("g")
    .attr("clip-path", "url(#alignment-overview-clip)")
    .append("g");

  if (signal.length > 0 && reference) {
    // SVG y coordinates increase downward, so count zero maps to the bottom.
    const countScale = d3
      .scaleLinear()
      .domain([0, Math.max(1, d3.max(signal, ({ count }) => count) ?? 0)])
      .nice()
      .range([signalBottom, signalTop]);

    svg
      .append("text")
      .attr("x", leftMargin)
      .attr("y", 19)
      .attr("font-size", 14)
      .attr("font-weight", "bold")
      .text(`Ribo-seq · ${reference.name} reference · Dummy data`);

    svg
      .append("text")
      .attr("x", 10)
      .attr("y", signalTop + 15)
      .attr("font-size", 12)
      .text("Footprint count");

    svg
      .append("g")
      .attr("transform", `translate(${leftMargin}, 0)`)
      .call(d3.axisLeft(countScale).ticks(4));

    // Bind one rectangle to each mapped count and leave a little space between bars.
    // The half-column offset centers each bar over its corresponding base.
    const barWidth = (xScale(1) - xScale(0)) * 0.84;
    zoomGroup
      .selectAll(".ribo-seq-bar")
      .data(signal)
      .join("rect")
      .attr("class", "ribo-seq-bar")
      .attr("x", ({ column }) => xScale(column + 0.5) - barWidth / 2)
      .attr("y", ({ count }) => countScale(count))
      .attr("width", barWidth)
      .attr("height", ({ count }) => signalBottom - countScale(count))
      .attr("fill", "#176b65");
  }

  svg
    .selectAll(".overview-label")
    .data(sequences)
    .enter()
    .append("text")
    .attr("class", "overview-label")
    .attr("x", 10)
    .attr("y", (_, i) => topMargin + i * rowHeight + 5)
    .text((d) => d.name)
    .attr("font-size", 12);

  // Treat the end of each sequence as a gap to close the final bar.
  sequences.forEach((item, rowIndex) => {
    const sequence = item.sequence;
    const y = topMargin + rowIndex * rowHeight - 8;

    let segmentStart = -1;

    for (let i = 0; i <= sequence.length; i++) {
      const isGap = i === sequence.length || sequence[i] === "-";

      if (!isGap && segmentStart === -1) {
        segmentStart = i;
      }

      if (isGap && segmentStart !== -1) {
        zoomGroup
          .append("rect")
          .attr("class", "overview-bar")
          .attr("x", xScale(segmentStart))
          .attr("y", y)
          .attr("width", xScale(i) - xScale(segmentStart))
          .attr("height", 6)
          .attr("fill", "#0d6efd");

        segmentStart = -1;
      }
    }
  });

  const nucleotideLetters = zoomGroup
    .selectAll<SVGTextElement, { base: string; position: number; row: number }>(
      ".overview-nucleotide",
    )
    .data(
      sequences.flatMap((item, row) =>
        item.sequence.split("").map((base, position) => ({
          base,
          position,
          row,
        })),
      ),
    )
    .join("text")
    .attr("class", "overview-nucleotide")
    .attr("x", (d) => xScale(d.position + 0.5))
    .attr("y", (d) => topMargin + d.row * rowHeight + 2)
    .attr("text-anchor", "middle")
    .attr("font-family", "monospace")
    .attr("font-size", 14)
    .attr("font-weight", (d) =>
      columns[d.position].category === "variable" ? "bold" : "normal",
    )
    .attr("fill", (d) =>
      alignmentBaseColor(d.base, columns[d.position].category),
    )
    .attr("display", "none")
    .text((d) => d.base);

  // Place 1-based axis ticks at the centers of the 0-based alignment columns.
  const positionScale = xScale.copy().domain([0.5, alignmentLength + 0.5]);
  function drawPositionAxis(scale: typeof positionScale) {
    const [start, end] = scale.domain();
    return d3
      .axisBottom(scale)
      .tickValues(
        d3
          .ticks(start, end, 10)
          .filter(
            (position) =>
              Number.isInteger(position) &&
              position >= 1 &&
              position <= alignmentLength,
          ),
      )
      .tickFormat(d3.format("d"));
  }

  svg
    .append("g")
    .attr("class", "overview-axis")
    .attr(
      "transform",
      `translate(0, ${topMargin + sequences.length * rowHeight})`,
    )
    .call(drawPositionAxis(positionScale));

  svg
    .append("text")
    .attr("x", (leftMargin + width - rightMargin) / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .text("Alignment column");

  const zoomBehavior = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([1, 100])
    .translateExtent([
      [leftMargin, 0],
      [width - rightMargin, height],
    ])
    .extent([
      [leftMargin, 0],
      [width - rightMargin, height],
    ])
    .on("zoom", (event) => {
      const transform = event.transform;

      const nucleotideWidth = (xScale(1) - xScale(0)) * transform.k;

      // Switch to letters once each nucleotide has enough space to be legible.
      const showLetters = nucleotideWidth >= 14;

      zoomGroup
        .selectAll<SVGRectElement, unknown>(".overview-bar")
        .attr("display", showLetters ? "none" : null);

      // Counteract horizontal zoom so the letters keep their original width.
      nucleotideLetters
        .attr("display", showLetters ? null : "none")
        .attr("transform", (d) => {
          const x = xScale(d.position + 0.5);

          return `translate(${x}, 0) scale(${1 / transform.k}, 1) translate(${-x}, 0)`;
        });

      // Move both tracks horizontally together while the count axis stays fixed.
      zoomGroup.attr(
        "transform",
        `translate(${transform.x}, 0) scale(${transform.k}, 1)`,
      );

      // Recalculate the visible column range for the bottom axis.
      const zoomedScale = transform.rescaleX(positionScale);

      svg
        .select<SVGGElement>(".overview-axis")
        .call(drawPositionAxis(zoomedScale));
    });

  svg.call(zoomBehavior);
}
