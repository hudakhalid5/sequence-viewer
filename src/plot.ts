// D3 handles SVG drawing, scales, axes and zoom interaction.
import * as d3 from "d3";

// One record in a multiple-sequence alignment.
export type AlignedSequence = {
  name: string;
  sequence: string;
};

// Demonstration alignment used when no FASTA alignment is uploaded.
export const exampleAlignment: AlignedSequence[] = [
  { name: "Human", sequence: "ATGCCATGAACT".repeat(8) },
  { name: "Mouse", sequence: "ATGCCATGAGCT".repeat(8) },
  { name: "Rat", sequence: "ATGCCATGA-CT".repeat(8) },
];

// Draw a single nucleotide sequence with a position axis and zoom.
export function drawSequence(sequence: string): void {
  // Prepare sequence data and nucleotide colors.
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

  console.log("Start:", xScale(0));
  console.log("Middle:", xScale(sequenceLength / 2));
  console.log("End:", xScale(sequenceLength));
  console.log("Sequence received:", sequence);
  console.log("Sequence length:", sequenceLength);

  // Clear the previous visualization before drawing a new SVG.
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

// Draw a wrapped multiple-sequence alignment with a legend and statistics.
export function drawAlignment(sequences: AlignedSequence[]): void {
  if (sequences.length === 0) {
    return;
  }

  const alignmentLength = sequences[0].sequence.length;

  // Validate alignment lengths before calculating statistics.
  if (sequences.some((item) => item.sequence.length !== alignmentLength)) {
    console.error("All aligned sequences must have the same length.");
    return;
  }

  // Classify each alignment column into one exclusive category.
  let conservedCount = 0;
  let variableCount = 0;
  let ambiguousCount = 0;
  let gapColumnCount = 0;
  let gapCount = 0;

  for (let columnIndex = 0; columnIndex < alignmentLength; columnIndex++) {
    const nucleotides = sequences.map((seq) => seq.sequence[columnIndex]);

    // Count individual gap characters independently.
    gapCount += nucleotides.filter((base) => base === "-").length;

    // Classification priority: gap, ambiguous, variable, conserved.
    if (nucleotides.includes("-")) {
      gapColumnCount++;
    } else if (nucleotides.includes("N")) {
      ambiguousCount++;
    } else if (new Set(nucleotides).size > 1) {
      variableCount++;
    } else {
      conservedCount++;
    }
  }

  // Calculate percentages using alignment columns.
  const conservationPercentage = (conservedCount / alignmentLength) * 100;
  const variablePercentage = (variableCount / alignmentLength) * 100;
  const ambiguousPercentage = (ambiguousCount / alignmentLength) * 100;
  const gapColumnPercentage = (gapColumnCount / alignmentLength) * 100;

  // Gap-character percentage uses all sequence characters.
  const totalCharacters = sequences.length * alignmentLength;
  const gapPercentage = (gapCount / totalCharacters) * 100;

  console.log("Alignment statistics:", {
    conservedCount,
    variableCount,
    ambiguousCount,
    gapColumnCount,
    gapCount,
    conservationPercentage,
    variablePercentage,
    ambiguousPercentage,
    gapColumnPercentage,
    gapPercentage,
  });

  // Layout: 40 alignment columns per block, one row per sequence.
  const columnsPerBlock = 90;
  const numberOfBlocks = Math.ceil(alignmentLength / columnsPerBlock);

  const columnWidth = 12;
  const rowHeight = 28;
  const blockSpacing = 30;
  const topMargin = 140;

  // Calculate the space needed for the longest sequence name.
  // Fixed-width label column.
  const leftMargin = 180;
  const labelFontSize = 13;
  const labelMaxWidth = leftMargin - 20;

  // Measure label widths to truncate only when necessary.
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
  container.selectAll("*").remove();

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
    .attr("stroke", "#b91c1c");

  svg
    .append("text")
    .attr("x", 28)
    .attr("y", 15)
    .attr("font-size", 12)
    .attr("fill", "#364152")
    .text("Variable alignment column");

  svg
    .append("rect")
    .attr("x", 250)
    .attr("y", 5)
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", "#dbeafe")
    .attr("stroke", "#1d4ed8");

  svg
    .append("text")
    .attr("x", 268)
    .attr("y", 15)
    .attr("font-size", 12)
    .attr("fill", "#364152")
    .text("Alignment gap (-)");

  svg
    .append("text")
    .attr("x", 410)
    .attr("y", 15)
    .attr("font-size", 12)
    .attr("fill", "#15803d")
    .text("Conserved");

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

  // Draw position labels and sequence rows for each wrapped block.
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

        // Compare the current column with the first sequence.
        const isDifferent = sequences.some(
          (seq) =>
            seq.sequence[columnIndex] !== sequences[0].sequence[columnIndex],
        );

        const isGap = nucleotide === "-";

        const isConserved = !isDifferent && !isGap;

        // Highlight gaps in blue, N in grey and mismatches in red.
        if (isDifferent) {
          svg
            .append("rect")
            .attr("x", x)
            .attr("y", y - 16)
            .attr("width", columnWidth)
            .attr("height", 20)
            .attr(
              "fill",
              isGap
                ? "#dbeafe" // Light blue: gap
                : nucleotide === "N"
                  ? "#e5e7eb" // Light grey: unknown nucleotide
                  : "#fde2e2", // Light red: mismatch
            );
        }

        svg
          .append("text")
          .attr("x", x + columnWidth / 2)
          .attr("y", y)
          .attr("text-anchor", "middle")
          .attr("font-family", "monospace")
          .attr("font-size", 14)
          .attr("font-weight", isDifferent ? "bold" : "normal")
          .attr(
            "fill",
            isGap
              ? "#1d4ed8" // Blue: gap
              : nucleotide === "N"
                ? "#6b7280" // Grey: unknown nucleotide
                : isDifferent
                  ? "#b91c1c" // Red: mismatch
                  : isConserved
                    ? "#15803d" // Green: conserved
                    : "#364152",
          )
          .text(nucleotide);
      }
    });
  }
}

// Draw a horizontal overview of aligned sequences.

export function drawSequenceOverview(sequences: AlignedSequence[]): void {
  if (sequences.length === 0) return;

  const alignmentLength = sequences[0].sequence.length;

  // Dimensions
  const width = 800;
  const leftMargin = 150;
  const rightMargin = 30;
  const rowHeight = 40;
  const topMargin = 30;
  const height = topMargin + sequences.length * rowHeight + 40;

  // Shared horizontal scale
  const xScale = d3
    .scaleLinear()
    .domain([0, alignmentLength])
    .range([leftMargin, width - rightMargin]);

  // Create the SVG inside the existing plot container
  const svg = d3
    .select("#sequence-plot")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Group for elements that will respond to zoom
  const zoomGroup = svg.append("g").attr("class", "overview-zoom-group");

  // Draw sequence names
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

  console.log("OVERVIEW FUNCTION CALLED");

  // Draw horizontal bars with breaks at alignment gaps
  sequences.forEach((item, rowIndex) => {
    const sequence = item.sequence;
    const y = topMargin + rowIndex * rowHeight - 8;

    let segmentStart = -1;

    for (let i = 0; i <= sequence.length; i++) {
      const isGap = i === sequence.length || sequence[i] === "-";

      // Start a new segment when a nucleotide is found
      if (!isGap && segmentStart === -1) {
        segmentStart = i;
      }

      // End the current segment when a gap is found
      if (isGap && segmentStart !== -1) {
        zoomGroup
          .append("rect")
          .attr("class", "overview-bar")
          .attr("x", xScale(segmentStart))
          .attr("y", y)
          .attr("width", xScale(i) - xScale(segmentStart))
          .attr("height", 12)
          .attr("fill", "#0d6efd");

        segmentStart = -1;
      }
    }
  });

  // Create nucleotide letters, initially hidden
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
    .attr("fill", "#ffffff")
    .attr("display", "none")
    .text((d) => d.base);

  // Alignment position axis
  const xAxis = d3.axisBottom(xScale).ticks(10);

  svg
    .append("g")
    .attr("class", "overview-axis")
    .attr(
      "transform",
      `translate(0, ${topMargin + sequences.length * rowHeight})`,
    )
    .call(xAxis);

  // Enable horizontal zoom and pan for the sequence bars
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

      // Calculate the visible width of one nucleotide
      const nucleotideWidth = (xScale(1) - xScale(0)) * transform.k;

      // Letters become readable at approximately 14 pixels
      const showLetters = nucleotideWidth >= 14;

      // Show letters when zoomed in, without stretching the text
      nucleotideLetters
        .attr("display", showLetters ? null : "none")
        .attr("transform", (d) => {
          const x = xScale(d.position + 0.5);

          return `translate(${x}, 0) scale(${1 / transform.k}, 1) translate(${-x}, 0)`;
        });

      console.log("Nucleotide width:", nucleotideWidth);
      console.log("Show letters:", showLetters);

      // Zoom horizontally while keeping row positions fixed
      zoomGroup.attr(
        "transform",
        `translate(${transform.x}, 0) scale(${transform.k}, 1)`,
      );

      // Update the position axis to match the zoomed bars
      const zoomedScale = transform.rescaleX(xScale);

      svg
        .select<SVGGElement>(".overview-axis")
        .call(d3.axisBottom(zoomedScale).ticks(10));
    });

  // Attach zoom interaction to the SVG
  svg.call(zoomBehavior);
}
