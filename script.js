const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
let mapImage = new Image();
let imageData;
let courier = { x: null, y: null, angle: 0 };
let pickup = { x: null, y: null };
let goal = { x: null, y: null };
let mapLoaded = false;
const cellSize = 2;
let animationId = null;

document.getElementById('mapLoader').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      mapImage.onload = function () {
        // ✅ Sesuaikan ukuran peta dalam rentang yang telah ditentukan
        canvas.width = Math.min(Math.max(mapImage.width, 1000), 1500);
        canvas.height = Math.min(Math.max(mapImage.height, 700), 1000);
        
        ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        mapLoaded = true;
        drawScene();
      };
      mapImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

function isRoad(x, y) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const ix = Math.floor(x + dx);
      const iy = Math.floor(y + dy);
      const index = (iy * canvas.width + ix) * 4;
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      if (r >= 90 && r <= 150 && g >= 90 && g <= 150 && b >= 90 && b <= 150) {
        return true;
      }
    }
  }
  return false;
}

function getRandomRoadPosition() {
  let x, y, tries = 0;
  while (tries < 5000) {
    x = Math.random() * canvas.width;
    y = Math.random() * canvas.height;
    if (isRoad(x, y)) {
      return { x, y };
    }
    tries++;
  }
  return null; // ➕ kembalikan null jika gagal
}

function toGridCoord(x, y) {
  return {
    gx: Math.floor(x / cellSize),
    gy: Math.floor(y / cellSize)
  };
}

function fromGridCoord(gx, gy) {
  return {
    x: gx * cellSize + cellSize / 2,
    y: gy * cellSize + cellSize / 2
  };
}

function heuristic(a, b) {
  return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy);
}

function aStar(start, end) {
  const cols = Math.floor(canvas.width / cellSize);
  const rows = Math.floor(canvas.height / cellSize);
  
  const openSet = new Set([`${start.gx},${start.gy}`]);
  const cameFrom = new Map();
  
  const gScore = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  gScore[start.gy][start.gx] = 0;
  
  const fScore = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  fScore[start.gy][start.gx] = heuristic(start, end);

  const directions = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
  ];

  while (openSet.size > 0) {
    let current = null;
    let lowestFScore = Infinity;
    
    for (const coord of openSet) {
      const [gx, gy] = coord.split(',').map(Number);
      if (fScore[gy][gx] < lowestFScore) {
        lowestFScore = fScore[gy][gx];
        current = { gx, gy };
      }
    }

    if (current.gx === end.gx && current.gy === end.gy) {
      const path = [];
      let curr = current;
      while (cameFrom.has(`${curr.gx},${curr.gy}`)) {
        path.unshift(curr);
        curr = cameFrom.get(`${curr.gx},${curr.gy}`);
      }
      path.unshift(start);
      return path;
    }

    openSet.delete(`${current.gx},${current.gy}`);

    for (const { dx, dy } of directions) {
      const neighbor = {
        gx: current.gx + dx,
        gy: current.gy + dy
      };

      if (
        neighbor.gx < 0 || neighbor.gy < 0 ||
        neighbor.gx >= cols || neighbor.gy >= rows
      ) continue;

      const pixel = fromGridCoord(neighbor.gx, neighbor.gy);
      if (!isRoad(pixel.x, pixel.y)) continue;

      const tentativeGScore = gScore[current.gy][current.gx] + 1;
      if (tentativeGScore < gScore[neighbor.gy][neighbor.gx]) {
        cameFrom.set(`${neighbor.gx},${neighbor.gy}`, current);
        gScore[neighbor.gy][neighbor.gx] = tentativeGScore;
        fScore[neighbor.gy][neighbor.gx] = tentativeGScore + heuristic(neighbor, end);
        openSet.add(`${neighbor.gx},${neighbor.gy}`);
      }
    }
  }

  return [];
}

function smoothPath(path) {
  if (path.length < 3) return path;
  
  const smoothed = [path[0]];
  let lastAdded = 0;
  
  for (let i = 1; i < path.length - 1; i++) {
    const prev = smoothed[smoothed.length - 1];
    const next = path[i + 1];
    
    const dx = next.gx - prev.gx;
    const dy = next.gy - prev.gy;
    let canSkip = true;
    
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      const gx = Math.round(prev.gx + dx * t);
      const gy = Math.round(prev.gy + dy * t);
      
      const pixel = fromGridCoord(gx, gy);
      if (!isRoad(pixel.x, pixel.y)) {
        canSkip = false;
        break;
      }
    }
    
    if (!canSkip) {
      smoothed.push(path[i]);
      lastAdded = i;
    }
  }
  
  smoothed.push(path[path.length - 1]);
  return smoothed;
}

function randomizePositions() {
  if (!mapLoaded) return alert('Load peta terlebih dahulu!');
  if (animationId) cancelAnimationFrame(animationId);

  const start = getRandomRoadPosition();
  const pickupPos = getRandomRoadPosition();
  const goalPos = getRandomRoadPosition();

  if (!start || !pickupPos || !goalPos) {
    alert("Gagal menemukan posisi valid di jalan.");
    return;
  }

  courier = { ...start, angle: 0 };
  pickup = pickupPos;
  goal = goalPos;
  drawScene();
}
// ✅ Perubahan 2: Kurir lebih kecil
function drawCourier() {
  if (courier.x === null) return;
  const { x, y, angle } = courier;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(6, 0);     // Lebih kecil
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fillStyle = 'blue';
  ctx.fill();
  ctx.restore();
}

function drawFlag(pos, color) {
  if (pos.x === null) return;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawScene() {
  ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
  drawFlag(pickup, 'yellow');
  drawFlag(goal, 'red');
  drawCourier();
}

function startSimulation() {
  if (!mapLoaded) return alert('Load peta terlebih dahulu!');
  
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  const startGrid = toGridCoord(courier.x, courier.y);
  const pickupGrid = toGridCoord(pickup.x, pickup.y);
  const goalGrid = toGridCoord(goal.x, goal.y);
  
  const toPickup = aStar(startGrid, pickupGrid);
  const toGoal = aStar(pickupGrid, goalGrid);
  
  if (toPickup.length === 0 || toGoal.length === 0) {
    alert('Jalur tidak ditemukan!');
    return;
  }
  
  const fullPath = [...smoothPath(toPickup), ...smoothPath(toGoal)];
  if (fullPath.length === 0) return;
  
  const waypoints = fullPath.map(point => fromGridCoord(point.gx, point.gy));
  let currentWaypointIndex = 0;
  let lastTimestamp = 0;
  const speed = 0.1;

  function animate(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    
    if (deltaTime > 100) {
      animationId = requestAnimationFrame(animate);
      return;
    }
    
    if (currentWaypointIndex >= waypoints.length) {
      drawScene();
      return;
    }
    
    const target = waypoints[currentWaypointIndex];
    const dx = target.x - courier.x;
    const dy = target.y - courier.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance < 2) {
      courier.x = target.x;
      courier.y = target.y;
      currentWaypointIndex++;
      animationId = requestAnimationFrame(animate);
      return;
    }
    
    const moveDistance = speed * deltaTime;
    const ratio = Math.min(moveDistance / distance, 1);
    
    courier.x += dx * ratio;
    courier.y += dy * ratio;
    
    const targetAngle = Math.atan2(dy, dx);
    let angleDiff = targetAngle - courier.angle;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    const rotationSpeed = 0.05;
    courier.angle += angleDiff * rotationSpeed;
    
    drawScene();
    animationId = requestAnimationFrame(animate);
  }
  
  animationId = requestAnimationFrame(animate);
}
