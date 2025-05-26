const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');

const gridSize = 20;
const rows = canvas.height / gridSize;
const cols = canvas.width / gridSize;

let grid = [];
let start = null;
let finish = null;
let path = [];
let interval = null;
let modeGambar = false;
let mapImage = null;

function loadMap() {
  const file = document.getElementById('mapInput').files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      mapImage = img;
      modeGambar = true;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      generateGridFromImage();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function generateGridFromImage() {
  grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = ((y * gridSize) * canvas.width + (x * gridSize)) * 4;
      const r = imageData[idx], g = imageData[idx + 1], b = imageData[idx + 2];
      const brightness = (r + g + b) / 3;
      if (brightness < 100) grid[y][x] = 1;
    }
  }

  drawMap();
}

function generateRandomMap() {
  modeGambar = false;
  mapImage = null;
  grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (Math.random() < 0.2 ? 1 : 0))
  );
  drawMap();
}

function setRandomStartFinish() {
  if (grid.length === 0) return;

  do {
    start = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows)
    };
  } while (grid[start.y][start.x] === 1);

  do {
    finish = {
      x: Math.floor(Math.random() * cols),
      y: Math.floor(Math.random() * rows)
    };
  } while (
    grid[finish.y][finish.x] === 1 ||
    (finish.x === start.x && finish.y === start.y)
  );

  drawMap();
}

function drawMap() {
  if (modeGambar && mapImage) {
    ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] === 1) {
          ctx.fillStyle = 'black';
          ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
        }
      }
    }
  }

  if (start) {
    ctx.fillStyle = 'yellow';
    ctx.fillRect(start.x * gridSize, start.y * gridSize, gridSize, gridSize);
  }

  if (finish) {
    ctx.fillStyle = 'red';
    ctx.fillRect(finish.x * gridSize, finish.y * gridSize, gridSize, gridSize);
  }
}

function drawRotatedEquilateralTriangle(x, y, angle, color) {
  const cx = x * gridSize + gridSize / 2;
  const cy = y * gridSize + gridSize / 2;
  const side = gridSize * 0.9;
  const h = (Math.sqrt(3) / 2) * side;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -h / 2); // This is the top (pointed) vertex
  ctx.lineTo(side / 2, h / 2);
  ctx.lineTo(-side / 2, h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function startKurir() {
  if (!start || !finish) return;
  path = findPath(start, finish);
  if (path.length === 0) {
    alert("Tidak ditemukan jalur!");
    return;
  }

  let i = 0;
  interval = setInterval(() => {
    drawMap();

    for (let j = 0; j <= i; j++) {
      const pos = path[j];
      ctx.fillStyle = '#a5d6a7';
      ctx.fillRect(pos.x * gridSize, pos.y * gridSize, gridSize, gridSize);
    }

    if (i < path.length - 1) {
      const curr = path[i];
      const next = path[i + 1];
      const dx = next.x - curr.x;
      const dy = next.y - curr.y;
      const angle = Math.atan2(dy, dx);

      drawRotatedEquilateralTriangle(curr.x, curr.y, angle, '#00c853');
      i++;
    } else {
      drawRotatedEquilateralTriangle(path[i].x, path[i].y, 0, '#00c853');
      clearInterval(interval);
    }
  }, 120);
}

function stopKurir() {
  clearInterval(interval);
  drawMap();
}

function findPath(start, finish) {
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const prev = Array.from({ length: rows }, () => Array(cols).fill(null));
  const queue = [start];
  visited[start.y][start.x] = true;

  const dirs = [
    { x: 0, y: -1 }, { x: 1, y: 0 },
    { x: 0, y: 1 }, { x: -1, y: 0 }
  ];

  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr.x === finish.x && curr.y === finish.y) {
      let path = [];
      let node = curr;
      while (node) {
        path.push(node);
        node = prev[node.y][node.x];
      }
      return path.reverse();
    }

    for (let d of dirs) {
      const nx = curr.x + d.x;
      const ny = curr.y + d.y;

      if (
        nx >= 0 && ny >= 0 && nx < cols && ny < rows &&
        !visited[ny][nx] && grid[ny][nx] === 0
      ) {
        visited[ny][nx] = true;
        prev[ny][nx] = curr;
        queue.push({ x: nx, y: ny });
      }
    }
  }

  return [];
}
