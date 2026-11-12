# Sequence Viewer

## Work in progress

An interactive web application. The project explores nucleotide sequence visualization and multiple-sequence alignment.

## Technology

- Vite and vanilla TypeScript
- D3.js for
- Bootstrap 5

## Run locally

Open a terminal and run:

```bash
git clone https://github.com/hudakhalid5/sequence-viewer.git
cd sequence-viewer
npm install
npm run dev
```

Open the **Local** URL printed by Vite.

## Features and project status

- DNA/RNA sequence input and validation
- FASTA upload and sequence processing
- Interactive SVG nucleotide visualization with D3.js
- Zoom and pan
- Multiple-sequence alignment
- Alignment conservation, mismatch and gap statistics
- Nucleotide coloring and alignment legend
- Show alignment button will show an example of 3 sequences alignment

## Repository structure

Typical source files used in this project:

```text
sequence-viewer/
├── index.html
├── package.json
├── src/
│   ├── main.ts
│   ├── plot.ts
│   └── style.css
└── README.md
```
