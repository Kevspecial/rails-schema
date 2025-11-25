# Project: SchemaViz AI - Database Schema Visualizer & Analyzer

## Role
Act as a Senior Frontend Engineer and UI/UX Designer specialized in Data Visualization and Generative AI integration.

## Goal
Build a React-based Single Page Application (SPA) that allows users to upload database schema files (Rails, Django, Prisma, SQL), visualizes them as an interactive interactive node-graph using D3.js, and analyzes the structure using the Google Gemini API.

## Tech Stack
- **Framework:** React 19 (Hooks, Functional Components).
- **Language:** TypeScript.
- **Styling:** Tailwind CSS (Dark Mode UI).
- **Visualization:** D3.js (v7) for force-directed graphs and layouts.
- **AI Integration:** `@google/genai` SDK (Gemini 2.5 Flash model).
- **Build Environment:** Browser-based (ES Modules).

## Core Features & Requirements

### 1. File Parsing (Schema Ingestion)
Create a robust parser service (`services/schemaParser.ts`) capable of handling multiple formats via RegEx and heuristic detection:
- **Ruby on Rails (`schema.rb`):** Parse `create_table`, columns, and `add_foreign_key`. Infer implicit relationships based on `_id` naming conventions.
- **SQL (`.sql`):** Parse `CREATE TABLE`, column definitions, and `FOREIGN KEY` constraints (inline and `ALTER TABLE`).
- **Prisma (`schema.prisma`):** Parse `model` blocks and `@relation` attributes.
- **Django (`models.py`):** Parse Python classes inheriting from `models.Model` and fields like `ForeignKey`.
- **Validation:** Limit file uploads to 5MB.

### 2. Interactive Visualization (The Graph)
Implement a `SchemaGraph` component using D3.js with the following capabilities:
- **Rendering:**
  - Nodes: Rounded rectangles representing tables.
  - Links: Lines with arrowheads representing Foreign Key relationships.
  - Labels: Table names centered in nodes.
- **Layout Algorithms (Switchable):**
  - `FORCE`: Organic force-directed layout (default).
  - `GRID`: Structured grid layout for organized viewing.
  - `CIRCLE`: Radial layout.
  - `TREE`: Hierarchical layout based on dependency levels.
- **Interactions:**
  - **Zoom/Pan:** Infinite canvas navigation.
  - **Drag:** Nodes can be dragged and pinned (`fx`, `fy`).
  - **Hover:** Hovering a relationship link highlights the connection and shows a tooltip with the Foreign Key column name.
  - **Selection:** Clicking a node highlights it and its direct neighbors, dimming the rest of the graph.
- **Search & Filtering:**
  - Search input in the header.
  - Matches highlight the specific nodes and links.
  - Non-matching nodes fade out.

### 3. Sidebar & Details
A collapsible sidebar that displays:
- **Table List:** A searchable list of all tables found in the schema.
- **Table Details:** When a table is selected (via graph or list), show its columns, types, and constraints.
- **Focus Mode:** A button to "Isolate" a table, hiding all other nodes except immediate neighbors.

### 4. AI Analysis (Gemini Integration)
Integrate Google Gemini (`services/geminiService.ts`) to analyze the schema:
- **Trigger:** A "Start Analysis" button in the sidebar.
- **Prompt:** Send the raw schema content to Gemini with a System Instruction acting as a Database Architect.
- **Output:** Request structured JSON containing:
  - `summary`: High-level domain overview.
  - `potentialIssues`: List of normalization errors, missing indexes, etc.
  - `suggestions`: Best practices and improvements.
- **Security:** Use `process.env.API_KEY`. Handle cases where the key is missing gracefully.

### 5. UI/UX & Aesthetics
- **Theme:** Modern Dark Mode (Gray-900 backgrounds, Blue/Purple accents).
- **Components:** Reusable `Button` component, responsive Header.
- **Feedback:** Loading spinners for AI, tooltips for interactions.
- **Error Handling:** Global `ErrorBoundary` component to catch React render crashes.

## Code Structure Guidelines

### `types.ts`
Define interfaces for `Table`, `Column`, `Relationship`, `SchemaData`, and `GraphNode`.
*Note:* To avoid runtime crashes in strict environments, define D3 simulation types manually instead of importing them from the D3 library.

### `App.tsx` (Main Logic)
- Manage global state (`schemaData`, `selectedTable`, `layout`, `searchTerm`).
- Handle file uploads using `FileReader`.
- Conditionally render the Graph or the "Empty State" upload prompt.
- Implement the "Focus Mode" logic (filtering data passed to the graph).

### `components/SchemaGraph.tsx` (D3 Logic)
- Use a `ref` for the SVG element.
- Use `useEffect` hooks to handle D3 lifecycle (enter/update/exit patterns).
- **Crucial:** When using D3 in React, use `any` for the selection/simulation types if TypeScript creates conflicts with the DOM elements, or strictly type them if the environment allows.
- Implement the custom "Hit Area" for links (a wider transparent line behind the visible line) to make hovering easier.

### `index.html` & Config
- Add a script to polyfill `window.process` to ensure `process.env` access works in the browser.
- Include Tailwind CDN.

## Step-by-Step Implementation Plan

1.  **Setup:** Create `index.html` with CSP and Tailwind. Create `metadata.json`.
2.  **Types:** Define the data models in `types.ts`.
3.  **Parsers:** Implement `parseSchema` in `services/schemaParser.ts` to handle the 4 regex strategies.
4.  **AI Service:** Implement `analyzeSchema` using `@google/genai` with `responseSchema` for JSON enforcement.
5.  **Components:** Build `Button`, `Sidebar`, and `ErrorBoundary`.
6.  **Graph Core:** Build `SchemaGraph.tsx`. Start with the Force layout. Add Zoom support. Then add the Layout Switcher logic.
7.  **Integration:** Wire everything in `App.tsx`. Add the Drag-and-Drop file zone.
8.  **Refinement:** Add tooltips, improve styles, and ensure error handling for bad file uploads.

