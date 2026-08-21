const $ = (id) => document.getElementById(id);
const moves = [
  [2, 1],
  [1, 2],
  [-1, 2],
  [-2, 1],
  [-2, -1],
  [-1, -2],
  [1, -2],
  [2, -1],
];

let running = false;
let runId = 0;

function legal(position, size) {
  const row = Math.floor(position / size);
  const column = position % size;

  return moves
    .map(([rowOffset, columnOffset]) => ({ row: row + rowOffset, column: column + columnOffset }))
    .filter(({ row: nextRow, column: nextColumn }) => nextRow >= 0 && nextColumn >= 0 && nextRow < size && nextColumn < size)
    .map(({ row: nextRow, column: nextColumn }) => nextRow * size + nextColumn);
}

function isKnightMove(from, to, size) {
  const rowDistance = Math.abs(Math.floor(from / size) - Math.floor(to / size));
  const columnDistance = Math.abs((from % size) - (to % size));
  return (rowDistance === 2 && columnDistance === 1) || (rowDistance === 1 && columnDistance === 2);
}

function isValidTour(path, size, closed) {
  if (path.length !== size * size || new Set(path).size !== path.length) return false;
  if (!path.every((square) => Number.isInteger(square) && square >= 0 && square < size * size)) return false;
  if (!path.slice(1).every((square, index) => isKnightMove(path[index], square, size))) return false;
  return !closed || isKnightMove(path[path.length - 1], path[0], size);
}

function solve(size, start, heuristic, closed, budget) {
  const visited = new Set([start]);
  const path = [start];
  const cap = heuristic ? Math.max(budget, 120000) : budget;
  const startedAt = performance.now();
  let nodes = 0;

  function dfs(position) {
    nodes += 1;
    if (nodes > cap) return false;
    if (path.length === size * size) return !closed || legal(position, size).includes(start);

    const next = legal(position, size).filter((square) => !visited.has(square));
    if (heuristic) {
      next.sort(
        (a, b) =>
          legal(a, size).filter((square) => !visited.has(square)).length -
          legal(b, size).filter((square) => !visited.has(square)).length,
      );
    }

    for (const square of next) {
      visited.add(square);
      path.push(square);
      if (dfs(square)) return true;
      path.pop();
      visited.delete(square);
    }
    return false;
  }

  const found = dfs(start);
  const success = found && isValidTour(path, size, closed);
  return {
    path: success ? path : [...path],
    nodes,
    success,
    time: performance.now() - startedAt,
    capped: nodes > cap,
  };
}

function setupBoard(id, size) {
  const board = $(id);
  board.replaceChildren();
  board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${size}, 1fr)`;

  for (let index = 0; index < size * size; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    board.append(cell);
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('path');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  svg.append(polyline);
  board.append(svg);

  const knight = document.createElement('div');
  knight.className = 'knight';
  knight.textContent = '\u265e';
  board.append(knight);
  return { cells: [...board.querySelectorAll('.cell')], polyline, knight };
}

function placeKnight(ui, position, size) {
  const row = Math.floor(position / size);
  const column = position % size;
  ui.knight.style.left = `${((column + 0.5) / size) * 100}%`;
  ui.knight.style.top = `${((row + 0.5) / size) * 100}%`;
}

function clearBoardTrail(ui) {
  ui.cells.forEach((cell) => {
    cell.classList.remove('visited');
    cell.replaceChildren();
  });
  ui.polyline.removeAttribute('points');
}

function renderPath(ui, path, size, visibleMoves) {
  path.slice(0, visibleMoves).forEach((position) => {
    const cell = ui.cells[position];
    cell.classList.add('visited');
  });
  const trail = path.slice(Math.max(0, visibleMoves - 3), visibleMoves);
  const points = trail.map((position) => {
    const row = Math.floor(position / size);
    const column = position % size;
    return `${((column + 0.5) / size) * 100},${((row + 0.5) / size) * 100}`;
  });
  ui.polyline.setAttribute('points', points.join(' '));
  if (visibleMoves) placeKnight(ui, path[visibleMoves - 1], size);
}

function setMetrics(prefix, result, visibleMoves) {
  const explored = Math.min(
    result.nodes,
    Math.max(visibleMoves, Math.floor((result.nodes * visibleMoves) / result.path.length)),
  );
  $(`${prefix}Moves`).textContent = visibleMoves;
  $(`${prefix}Nodes`).textContent = explored.toLocaleString();
  $(`${prefix}Time`).textContent = result.time < 1 ? '<1 ms' : `${result.time.toFixed(1)} ms`;
  $(`${prefix}Progress`).style.width = `${(visibleMoves / result.path.length) * 100}%`;
}

async function animate(prefix, ui, result, size, token, loop) {
  const delay = Math.max(55, Number($('speed').value));
  const jump = Math.round(delay * 0.78);
  const repeat = loop && result.success;
  ui.knight.style.setProperty('--jump', `${jump}ms`);
  while (token === runId) {
    clearBoardTrail(ui);
    renderPath(ui, result.path, size, 1);
    setMetrics(prefix, result, 1);

    for (let move = 2; move <= result.path.length; move += 1) {
      if (token !== runId) return;
      placeKnight(ui, result.path[move - 1], size);
      await new Promise((resolve) => setTimeout(resolve, jump));
      if (token !== runId) return;
      renderPath(ui, result.path, size, move);
      setMetrics(prefix, result, move);
      await new Promise((resolve) => setTimeout(resolve, delay - jump));
    }

    if (!repeat) {
      const status = result.success
        ? $('closed').checked
          ? 'CLOSED \u2713'
          : 'OPEN \u2713'
        : result.capped
          ? 'LIMITED'
          : 'NO TOUR';
      $(`${prefix}Status`).textContent = status;
      $(`${prefix}Status`).style.color = result.success ? '#ffd179' : '#ffaaa7';
      return;
    }

    $(`${prefix}Status`).textContent = 'LOOPING \u21bb';
    $(`${prefix}Status`).style.color = '#8fe39a';
    placeKnight(ui, result.path[0], size);
    await new Promise((resolve) => setTimeout(resolve, jump));
    if (token !== runId) return;
    renderPath(ui, [...result.path, result.path[0]], size, result.path.length + 1);
    await new Promise((resolve) => setTimeout(resolve, delay - jump));
  }
}

function updateStartOptions(size) {
  const start = $('start');
  const choices = [
    0,
    size - 1,
    Math.floor(size / 2) * size + Math.floor(size / 2),
    Math.floor((size - 1) / 2) * size + Math.floor((size - 1) / 2),
  ];
  const uniqueChoices = [...new Set(choices)];
  start.replaceChildren(
    ...uniqueChoices.map((position) => {
      const option = document.createElement('option');
      option.value = position;
      option.textContent = `${String.fromCharCode(65 + (position % size))}${Math.floor(position / size) + 1}`;
      return option;
    }),
  );
  start.value = String(uniqueChoices[Math.min(2, uniqueChoices.length - 1)]);
}

function settings() {
  return {
    size: Number($('size').value),
    start: Number($('start').value),
    closed: $('closed').checked,
    loop: $('closed').checked && $('loop').checked,
    budget: Number($('budget').value),
  };
}

async function run(one) {
  if (running) return;
  running = true;
  const token = ++runId;
  const currentSettings = settings();
  $('run').textContent = 'CALCULATING\u2026';
  $('topStatus').textContent = 'RUNNING';
  const kinds = one ? [one] : ['warn', 'back'];
  kinds.forEach((prefix) => {
    $(`${prefix}Status`).textContent = 'SEARCHING';
    $(`${prefix}Status`).style.color = '';
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
  const jobs = kinds.map((prefix) => ({
    prefix,
    result: solve(
      currentSettings.size,
      currentSettings.start,
      prefix === 'warn',
      currentSettings.closed,
      currentSettings.budget,
    ),
    ui: setupBoard(`${prefix}Board`, currentSettings.size),
  }));
  const report = jobs
    .map(
      ({ prefix, result }) =>
        `${prefix === 'warn' ? 'Warnsdorff' : 'Backtracking'} examined ${result.nodes.toLocaleString()} positions`,
    )
    .join(' \u00b7 ');
  const isLooping = currentSettings.loop && jobs.some(({ result }) => result.success);
  $('run').textContent = isLooping ? 'LOOPING\u2026' : 'ANIMATING\u2026';
  if (isLooping) $('topStatus').textContent = 'LOOPING';
  $('insightTitle').textContent = jobs.some(({ result }) => result.success)
    ? 'A tour was found. Watch every landing lock to the trail.'
    : 'No completed route in this search budget.';
  $('insightText').textContent = `${report}. Increase the budget or switch to an open tour to explore more paths.`;

  await Promise.all(
    jobs.map(({ prefix, ui, result }) => animate(prefix, ui, result, currentSettings.size, token, currentSettings.loop)),
  );
  if (token === runId) {
    $('topStatus').textContent = 'COMPLETE';
    $('run').innerHTML = '<span>&#9654;</span> RACE BOTH';
    running = false;
  }
}

function reset() {
  runId += 1;
  running = false;
  const size = Number($('size').value);
  setupBoard('warnBoard', size);
  setupBoard('backBoard', size);
  ['warn', 'back'].forEach((prefix) => {
    ['Time', 'Moves', 'Nodes', 'Status'].forEach((metric) => {
      $(`${prefix}${metric}`).textContent = metric === 'Status' ? 'IDLE' : metric === 'Time' ? '\u2014' : '0';
    });
    $(`${prefix}Status`).style.color = '';
    $(`${prefix}Progress`).style.width = '0';
  });
  $('run').innerHTML = '<span>&#9654;</span> RACE BOTH';
  $('topStatus').textContent = 'READY';
}

$('size').addEventListener('input', (event) => {
  const size = Number(event.target.value);
  $('sizeValue').textContent = `${size} \u00d7 ${size}`;
  updateStartOptions(size);
  reset();
});
$('speed').addEventListener('input', (event) => {
  $('speedValue').textContent = `${event.target.value} ms`;
});
$('budget').addEventListener('input', (event) => {
  $('budgetValue').textContent = `${Number(event.target.value) / 1000}k`;
});
$('closed').addEventListener('change', () => {
  $('loop').disabled = !$('closed').checked;
  reset();
});
$('loop').addEventListener('change', reset);
$('run').addEventListener('click', () => run());
$('runWarn').addEventListener('click', () => run('warn'));
$('runBack').addEventListener('click', () => run('back'));
$('reset').addEventListener('click', reset);

updateStartOptions(Number($('size').value));
$('loop').disabled = !$('closed').checked;
reset();
