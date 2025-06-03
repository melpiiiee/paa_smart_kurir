const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
let mapImage = new Image();
let imageData;
let courier = { x: null, y: null, angle: 0 };
let pickup = { x: null, y: null };
let goal = { x: null, y: null };
let mapLoaded = false;
const cellSize = 5;
let animationId = null;

document.getElementById('mapLoader').addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      mapImage.onload = function () {
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
  const index = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  const r = imageData.data[index];
  const g = imageData.data[index + 1];
  const b = imageData.data[index + 2];
  return r >= 90 && r <= 150 && g >= 90 && g <= 150 && b >= 90 && b <= 150;
}

function getRandomRoadPosition() {
  let x, y, tries = 0;
  do {
    x = Math.random() * canvas.width;
    y = Math.random() * canvas.height;
    tries++;
    if (tries > 5000) {
      alert("Tidak ditemukan jalan yang valid!");
      return { x: 0, y: 0 };
    }
  } while (!isRoad(x, y));
  return { x, y };
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
  for (let i = 1; i < path.length - 1; i++) {
    const prev = smoothed[smoothed.length - 1];
    const curr = path[i];
    const next = path[i + 1];

    const dx1 = curr.gx - prev.gx;
    const dy1 = curr.gy - prev.gy;
    const dx2 = next.gx - curr.gx;
    const dy2 = next.gy - curr.gy;

    // Jika arah berubah, tambahkan titik saat ini
    if (dx1 !== dx2 || dy1 !== dy2) {
      smoothed.push(curr);
    }
  }
  smoothed.push(path[path.length - 1]);
  return smoothed;
}

function randomizePositions() {
  if (!mapLoaded) return alert('Load peta terlebih dahulu!');

  // Hentikan animasi jika sedang berjalan
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  courier = { ...getRandomRoadPosition(), angle: 0 };
  pickup = getRandomRoadPosition();
  goal = getRandomRoadPosition();
  drawScene();
}

function drawCourier() {
  if (courier.x === null) return;
  const { x, y, angle } = courier;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, -7);
  ctx.lineTo(-7, 7);
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

  // Hentikan animasi sebelumnya jika ada
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

  const rawPath = [...toPickup.slice(0, -1), ...toGoal]; // Gabung path, hindari duplikasi titik tengah
  const smoothedPath = smoothPath(rawPath);
  if (smoothedPath.length === 0) return;

  const waypoints = smoothedPath.map(point => fromGridCoord(point.gx, point.gy));
  let currentWaypointIndex = 0;
  let lastTimestamp = 0;
  const speed = 0.1; // pixel per ms
  const rotationSpeed = 0.1; // radians per ms (adjust for faster/slower rotation)

  function animate(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    // Lewati jika deltaTime terlalu besar (tab berpindah)
    if (deltaTime > 100) {
      animationId = requestAnimationFrame(animate);
      return;
    }

    // Jika sudah mencapai semua waypoint
    if (currentWaypointIndex >= waypoints.length) {
      drawScene();
      return;
    }

    const target = waypoints[currentWaypointIndex];
    const dx = target.x - courier.x;
    const dy = target.y - courier.y;
    const distance = Math.hypot(dx, dy);

    // Hitung sudut target
    const targetAngle = Math.atan2(dy, dx);
    let angleDiff = targetAngle - courier.angle;

    // Normalisasi sudut
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Rotasi kurir
    const rotateAmount = angleDiff * Math.min(1, rotationSpeed * deltaTime); // Limit rotation speed
    courier.angle += rotateAmount;

    // Pindahkan kurir
    const moveDistance = speed * deltaTime;
    const ratio = Math.min(moveDistance / distance, 1);
    courier.x += dx * ratio;
    courier.y += dy * ratio;

    // Jika sudah dekat, langsung ke waypoint berikutnya
    if (distance < 2) {
      courier.x = target.x;
      courier.y = target.y;
      currentWaypointIndex++;
    }

    drawScene();
    animationId = requestAnimationFrame(animate);
  }

  animationId = requestAnimationFrame(animate);
}