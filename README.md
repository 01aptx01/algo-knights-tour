# Knight's Tour Lab

An interactive, browser-based visualizer for exploring the Knight's Tour problem. Watch Warnsdorff's heuristic and classic depth-first backtracking search for a complete route, then compare their progress, explored nodes, timing, and final result side by side.

## Features

- Compare two solvers in the same simulation:
  - **Warnsdorff's heuristic** — chooses the next square with the fewest onward moves.
  - **Classic backtracking** — explores legal moves in their natural order.
- Visualize the knight's path, recent trail, move count, and progress in real time.
- Configure a board from **5×5 to 10×10**.
- Choose a starting square from the available presets.
- Run either an **open tour** or a **closed tour** that returns to the starting square.
- Adjust animation speed and the maximum search budget.
- Replay successful closed tours in loop mode.
- Reset the simulation at any time.
- Run locally without a build tool, package manager, or runtime dependency.

## Demo

This is a static website. Open `index.html` in a modern browser, or publish the project with any static hosting provider.

## Getting started

### Prerequisites

- A modern browser with JavaScript enabled.
- Optional: Node.js and npm if you want to format the source with Prettier.

### Run locally

The simplest option is to open `index.html` directly in your browser.

For a local web server, use any static server. For example:

```sh
npx --yes serve .
```

Then open the URL printed by the server.

No installation step or build step is required.

## How it works

Both solvers use depth-first search over legal knight moves. A route is accepted only when it:

1. Visits every square exactly once.
2. Contains only valid knight moves.
3. Returns to the origin when closed-tour mode is enabled.

The Warnsdorff solver orders each candidate by the number of unvisited squares available after moving there. This usually reduces branching significantly, but it is still implemented as heuristic-guided backtracking and can be affected by the search budget.

The classic solver follows the generated move order without that heuristic. Its search space grows rapidly, so larger boards or closed tours may reach the configured budget before a route is found.

### Search budget

The budget limits the number of DFS nodes examined by a solver. It is a practical safeguard against long-running searches in the browser, not a measure of algorithmic complexity. Increase it when a result is marked `LIMITED`.

## Project structure

```text
.
├── app.js          # Solver logic, simulation state, rendering, and controls
├── index.html      # Page structure and accessible control labels
├── style.css       # Visual design, responsive layout, and animations
├── .prettierrc.json
└── README.md
```

## Formatting

Format the source files with the repository's Prettier configuration:

```sh
npx --yes prettier --write app.js index.html style.css README.md
```

Check formatting without modifying files:

```sh
npx --yes prettier --check app.js index.html style.css README.md
```

## Browser support

The project uses standard browser APIs, including DOM manipulation, SVG, `performance.now()`, and `setTimeout()`. It should work in current versions of Chrome, Edge, Firefox, and Safari.

## Contributing

Contributions are welcome. Before opening a pull request:

1. Keep the project dependency-free unless a dependency is clearly justified.
2. Preserve the existing interaction and accessibility behavior.
3. Run the Prettier check.
4. Test open and closed tours, different board sizes, reset, and search-budget limits in a modern browser.

## License

No license file is currently included. Add a license before distributing or accepting external contributions.
