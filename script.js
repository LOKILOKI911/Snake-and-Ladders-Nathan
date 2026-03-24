const boardElement = document.getElementById("board");
const boardOverlay = document.getElementById("boardOverlay");
const tokenLayer = document.getElementById("tokenLayer");
const turnLabel = document.getElementById("turnLabel");
const statusMessage = document.getElementById("statusMessage");
const diceFace = document.getElementById("diceFace");
const rollButton = document.getElementById("rollButton");
const resetButton = document.getElementById("resetButton");
const applySettingsButton = document.getElementById("applySettingsButton");
const modeHumanButton = document.getElementById("modeHuman");
const modeCpuButton = document.getElementById("modeCpu");
const playerOneNameLabel = document.getElementById("playerOneName");
const playerTwoNameLabel = document.getElementById("playerTwoName");
const playerOnePos = document.getElementById("playerOnePos");
const playerTwoPos = document.getElementById("playerTwoPos");
const playerOneInput = document.getElementById("playerOneInput");
const playerTwoInput = document.getElementById("playerTwoInput");
const logList = document.getElementById("logList");

const boardLinks = {
  ladders: [
    { start: 3, end: 22 },
    { start: 8, end: 30 },
    { start: 28, end: 84 },
    { start: 58, end: 77 },
    { start: 75, end: 86 },
    { start: 80, end: 99 },
  ],
  snakes: [
    { start: 17, end: 4 },
    { start: 52, end: 29 },
    { start: 57, end: 40 },
    { start: 62, end: 22 },
    { start: 88, end: 18 },
    { start: 95, end: 51 },
    { start: 97, end: 79 },
  ],
};

const snakes = Object.fromEntries(boardLinks.snakes.map((link) => [link.start, link.end]));
const ladders = Object.fromEntries(boardLinks.ladders.map((link) => [link.start, link.end]));

const players = [
  { id: 1, name: "Player 1", position: 1, tokenEl: null },
  { id: 2, name: "Player 2", position: 1, tokenEl: null },
];

const cellCenters = {};
const animationDurations = {
  step: 180,
  path: 75,
};

let currentPlayerIndex = 0;
let gameOver = false;
let isAnimating = false;
let gameMode = "human";
let resizeTimer = null;
let cpuTurnTimer = null;

function getBoardSequence() {
  const sequence = [];

  for (let row = 9; row >= 0; row -= 1) {
    const start = row * 10 + 1;
    const rowNumbers = Array.from({ length: 10 }, (_, index) => start + index);

    if ((9 - row) % 2 === 1) {
      rowNumbers.reverse();
    }

    sequence.push(...rowNumbers);
  }

  return sequence;
}

function createBoard() {
  const sequence = getBoardSequence();
  const fragment = document.createDocumentFragment();

  sequence.forEach((number) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.cell = String(number);

    const numberLabel = document.createElement("span");
    numberLabel.className = "cell-number";
    numberLabel.textContent = String(number);
    cell.appendChild(numberLabel);

    if (snakes[number]) {
      const marker = document.createElement("span");
      marker.className = "cell-marker snake";
      marker.textContent = `Snake to ${snakes[number]}`;
      cell.appendChild(marker);
    } else if (ladders[number]) {
      const marker = document.createElement("span");
      marker.className = "cell-marker ladder";
      marker.textContent = `Ladder to ${ladders[number]}`;
      cell.appendChild(marker);
    }

    const tokens = document.createElement("div");
    tokens.className = "tokens";
    cell.appendChild(tokens);

    fragment.appendChild(cell);
  });

  boardElement.innerHTML = "";
  boardElement.appendChild(fragment);
}

function createTokens() {
  tokenLayer.innerHTML = "";

  players.forEach((player) => {
    const token = document.createElement("span");
    token.className = `token player-${player.id}`;
    token.title = `${player.name} at ${player.position}`;
    tokenLayer.appendChild(token);
    player.tokenEl = token;
  });
}

function setGameMode(mode) {
  if (cpuTurnTimer) {
    window.clearTimeout(cpuTurnTimer);
    cpuTurnTimer = null;
  }

  gameMode = mode;
  modeHumanButton.classList.toggle("active", mode === "human");
  modeCpuButton.classList.toggle("active", mode === "cpu");
  playerTwoInput.value = mode === "cpu" ? "Computer" : playerTwoInput.value || "Player 2";
  playerTwoInput.disabled = mode === "cpu";
}

function normalizeName(name, fallback) {
  return name.trim().slice(0, 16) || fallback;
}

function applySettings(reset = true) {
  players[0].name = normalizeName(playerOneInput.value, "Player 1");
  players[1].name = gameMode === "cpu"
    ? "Computer"
    : normalizeName(playerTwoInput.value, "Player 2");

  playerOneInput.value = players[0].name;
  playerTwoInput.value = players[1].name;
  playerOneNameLabel.textContent = players[0].name;
  playerTwoNameLabel.textContent = players[1].name;

  if (reset) {
    resetGame();
  } else {
    updateSidebar();
    updateTokenPositions();
  }
}

function addLogEntry(message, isPriority = false) {
  const item = document.createElement("li");
  item.textContent = message;

  if (isPriority) {
    item.style.color = "#2f2419";
    item.style.fontWeight = "700";
  }

  logList.prepend(item);
}

function getCellCenter(number) {
  return cellCenters[number] || { x: 0, y: 0 };
}

function getTokenOffset(playerIndex) {
  const offsets = [
    { x: -14, y: 14 },
    { x: 14, y: -14 },
  ];
  return offsets[playerIndex];
}

function setTokenPosition(playerIndex, point) {
  const player = players[playerIndex];
  const offset = getTokenOffset(playerIndex);
  player.tokenEl.style.left = `${point.x + offset.x}px`;
  player.tokenEl.style.top = `${point.y + offset.y}px`;
  player.tokenEl.title = `${player.name} at ${player.position}`;
}

function updateTokenPositions() {
  players.forEach((player, index) => {
    const point = getCellCenter(player.position);
    setTokenPosition(index, point);
  });

  players.forEach((player, index) => {
    player.tokenEl.classList.toggle("active", index === currentPlayerIndex && !gameOver);
  });
}

function updateSidebar() {
  const activePlayer = players[currentPlayerIndex];
  turnLabel.textContent = gameOver ? "Game Over" : activePlayer.name;
  playerOnePos.textContent = `Position: ${players[0].position}`;
  playerTwoPos.textContent = `Position: ${players[1].position}`;
  statusMessage.textContent = gameOver
    ? `${activePlayer.name} has won the game.`
    : isAnimating
      ? `${activePlayer.name} is moving...`
      : `${activePlayer.name} is ready to roll.`;
}

function updateControlState() {
  const cpuTurn = gameMode === "cpu" && currentPlayerIndex === 1 && !gameOver;
  rollButton.disabled = gameOver || isAnimating || cpuTurn;
  applySettingsButton.disabled = isAnimating;
  resetButton.disabled = isAnimating;
}

function switchTurn() {
  currentPlayerIndex = currentPlayerIndex === 0 ? 1 : 0;
  updateSidebar();
  updateTokenPositions();
  updateControlState();

  if (gameMode === "cpu" && currentPlayerIndex === 1 && !gameOver) {
    players[1].tokenEl.classList.add("thinking");
    cpuTurnTimer = window.setTimeout(() => {
      players[1].tokenEl.classList.remove("thinking");
      cpuTurnTimer = null;
      takeTurn();
    }, 900);
  }
}

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function animateDieRoll(finalValue) {
  let ticks = 0;

  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      diceFace.textContent = String(Math.floor(Math.random() * 6) + 1);
      ticks += 1;

      if (ticks === 8) {
        window.clearInterval(timer);
        diceFace.textContent = String(finalValue);
        resolve();
      }
    }, 80);
  });
}

function buildSnakePoints(start, end) {
  const startPoint = getCellCenter(start);
  const endPoint = getCellCenter(end);
  const points = [];
  const segments = 14;

  for (let step = 0; step <= segments; step += 1) {
    const progress = step / segments;
    const swing = Math.sin(progress * Math.PI * 3) * 34;
    const x = startPoint.x + (endPoint.x - startPoint.x) * progress + swing;
    const y = startPoint.y + (endPoint.y - startPoint.y) * progress;
    points.push({ x, y });
  }

  return points;
}

function buildLadderPoints(start, end) {
  const startPoint = getCellCenter(start);
  const endPoint = getCellCenter(end);
  const points = [];
  const steps = 12;

  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    points.push({
      x: startPoint.x + (endPoint.x - startPoint.x) * progress,
      y: startPoint.y + (endPoint.y - startPoint.y) * progress,
    });
  }

  return points;
}

async function animateTokenPath(playerIndex, points, delay = animationDurations.path) {
  for (const point of points) {
    setTokenPosition(playerIndex, point);
    await wait(delay);
  }
}

async function animateTokenToCell(playerIndex, cellNumber) {
  const point = getCellCenter(cellNumber);
  setTokenPosition(playerIndex, point);
  await wait(animationDurations.step);
}

async function moveAcrossBoard(playerIndex, from, to) {
  const direction = from <= to ? 1 : -1;

  for (let number = from + direction; direction === 1 ? number <= to : number >= to; number += direction) {
    players[playerIndex].position = number;
    updateSidebar();
    await animateTokenToCell(playerIndex, number);
  }
}

async function animateSpecialMove(playerIndex, type, start, end) {
  const points = type === "ladder"
    ? buildLadderPoints(start, end)
    : buildSnakePoints(start, end);

  await animateTokenPath(playerIndex, points);
  players[playerIndex].position = end;
  updateSidebar();
  updateTokenPositions();
}

function drawLadder(link) {
  const start = getCellCenter(link.start);
  const end = getCellCenter(link.end);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const railOffset = 16;

  const railOne = document.createElementNS("http://www.w3.org/2000/svg", "line");
  railOne.setAttribute("x1", String(start.x + nx * railOffset));
  railOne.setAttribute("y1", String(start.y + ny * railOffset));
  railOne.setAttribute("x2", String(end.x + nx * railOffset));
  railOne.setAttribute("y2", String(end.y + ny * railOffset));
  railOne.setAttribute("class", "ladder-rail");

  const railTwo = document.createElementNS("http://www.w3.org/2000/svg", "line");
  railTwo.setAttribute("x1", String(start.x - nx * railOffset));
  railTwo.setAttribute("y1", String(start.y - ny * railOffset));
  railTwo.setAttribute("x2", String(end.x - nx * railOffset));
  railTwo.setAttribute("y2", String(end.y - ny * railOffset));
  railTwo.setAttribute("class", "ladder-rail");

  boardOverlay.appendChild(railOne);
  boardOverlay.appendChild(railTwo);

  for (let rung = 1; rung < 8; rung += 1) {
    const progress = rung / 8;
    const cx = start.x + dx * progress;
    const cy = start.y + dy * progress;
    const rungLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    rungLine.setAttribute("x1", String(cx + nx * railOffset));
    rungLine.setAttribute("y1", String(cy + ny * railOffset));
    rungLine.setAttribute("x2", String(cx - nx * railOffset));
    rungLine.setAttribute("y2", String(cy - ny * railOffset));
    rungLine.setAttribute("class", "ladder-rung");
    boardOverlay.appendChild(rungLine);
  }
}

function drawSnake(link) {
  const points = buildSnakePoints(link.start, link.end);
  const pathValue = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const lastPoint = points[points.length - 1];
  const beforeLast = points[points.length - 2];
  const angle = Math.atan2(lastPoint.y - beforeLast.y, lastPoint.x - beforeLast.x);

  const track = document.createElementNS("http://www.w3.org/2000/svg", "path");
  track.setAttribute("d", pathValue);
  track.setAttribute("class", "snake-track");

  const body = document.createElementNS("http://www.w3.org/2000/svg", "path");
  body.setAttribute("d", pathValue);
  body.setAttribute("class", "snake-body");

  const belly = document.createElementNS("http://www.w3.org/2000/svg", "path");
  belly.setAttribute("d", pathValue);
  belly.setAttribute("class", "snake-belly");

  const spotGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  for (let index = 2; index < points.length - 2; index += 3) {
    const point = points[index];
    const spot = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    spot.setAttribute("cx", String(point.x + (index % 2 === 0 ? -10 : 10)));
    spot.setAttribute("cy", String(point.y + 10));
    spot.setAttribute("rx", "11");
    spot.setAttribute("ry", "8");
    spot.setAttribute("class", "snake-spot");
    spotGroup.appendChild(spot);
  }

  const head = document.createElementNS("http://www.w3.org/2000/svg", "g");
  head.setAttribute("transform", `translate(${lastPoint.x}, ${lastPoint.y}) rotate(${angle * 180 / Math.PI})`);

  const cheek = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  cheek.setAttribute("cx", "14");
  cheek.setAttribute("cy", "2");
  cheek.setAttribute("rx", "12");
  cheek.setAttribute("ry", "16");
  cheek.setAttribute("class", "snake-cheek");

  const skull = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  skull.setAttribute("cx", "-2");
  skull.setAttribute("cy", "0");
  skull.setAttribute("rx", "30");
  skull.setAttribute("ry", "23");
  skull.setAttribute("class", "snake-head");

  const chin = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  chin.setAttribute("cx", "3");
  chin.setAttribute("cy", "10");
  chin.setAttribute("rx", "14");
  chin.setAttribute("ry", "9");
  chin.setAttribute("class", "snake-spot");

  const eyeOne = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  eyeOne.setAttribute("cx", "-12");
  eyeOne.setAttribute("cy", "-18");
  eyeOne.setAttribute("r", "12");
  eyeOne.setAttribute("class", "snake-eye");

  const eyeTwo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  eyeTwo.setAttribute("cx", "8");
  eyeTwo.setAttribute("cy", "-17");
  eyeTwo.setAttribute("r", "12");
  eyeTwo.setAttribute("class", "snake-eye");

  const pupilOne = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  pupilOne.setAttribute("cx", "-6");
  pupilOne.setAttribute("cy", "-13");
  pupilOne.setAttribute("r", "5.5");
  pupilOne.setAttribute("class", "snake-pupil");

  const pupilTwo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  pupilTwo.setAttribute("cx", "1");
  pupilTwo.setAttribute("cy", "-13");
  pupilTwo.setAttribute("r", "5.5");
  pupilTwo.setAttribute("class", "snake-pupil");

  const nostrilOne = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  nostrilOne.setAttribute("cx", "7");
  nostrilOne.setAttribute("cy", "4");
  nostrilOne.setAttribute("rx", "2.8");
  nostrilOne.setAttribute("ry", "1.8");
  nostrilOne.setAttribute("class", "snake-nostril");

  const nostrilTwo = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  nostrilTwo.setAttribute("cx", "-7");
  nostrilTwo.setAttribute("cy", "4");
  nostrilTwo.setAttribute("rx", "2.8");
  nostrilTwo.setAttribute("ry", "1.8");
  nostrilTwo.setAttribute("class", "snake-nostril");

  const smile = document.createElementNS("http://www.w3.org/2000/svg", "path");
  smile.setAttribute("d", "M -10 12 Q -2 18 8 12");
  smile.setAttribute("class", "snake-smile");

  head.appendChild(cheek);
  head.appendChild(skull);
  head.appendChild(chin);
  head.appendChild(eyeOne);
  head.appendChild(eyeTwo);
  head.appendChild(pupilOne);
  head.appendChild(pupilTwo);
  head.appendChild(nostrilOne);
  head.appendChild(nostrilTwo);
  head.appendChild(smile);

  boardOverlay.appendChild(track);
  boardOverlay.appendChild(body);
  boardOverlay.appendChild(belly);
  boardOverlay.appendChild(spotGroup);
  boardOverlay.appendChild(head);
}

function cacheCellCenters() {
  Object.keys(cellCenters).forEach((key) => {
    delete cellCenters[key];
  });

  const boardRect = boardElement.getBoundingClientRect();

  document.querySelectorAll(".cell").forEach((cell) => {
    const cellRect = cell.getBoundingClientRect();
    const number = Number(cell.dataset.cell);
    cellCenters[number] = {
      x: cellRect.left - boardRect.left + cellRect.width / 2,
      y: cellRect.top - boardRect.top + cellRect.height / 2,
    };
  });
}

function drawBoardOverlay() {
  boardOverlay.innerHTML = "";
  boardLinks.ladders.forEach(drawLadder);
  boardLinks.snakes.forEach(drawSnake);
}

function refreshBoardVisuals() {
  const boardRect = boardElement.getBoundingClientRect();
  boardOverlay.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
  cacheCellCenters();
  drawBoardOverlay();
  updateTokenPositions();
}

async function takeTurn() {
  if (gameOver || isAnimating) {
    return;
  }

  isAnimating = true;
  updateSidebar();
  updateControlState();

  const player = players[currentPlayerIndex];
  const dice = rollDice();
  const attemptedPosition = player.position + dice;

  await animateDieRoll(dice);
  addLogEntry(`${player.name} rolled a ${dice}.`);

  if (attemptedPosition > 100) {
    addLogEntry(`${player.name} needs an exact roll to reach 100, so they stay on ${player.position}.`);
    isAnimating = false;
    updateSidebar();
    updateControlState();
    switchTurn();
    return;
  }

  await moveAcrossBoard(currentPlayerIndex, player.position, attemptedPosition);

  if (ladders[player.position]) {
    const destination = ladders[player.position];
    addLogEntry(`${player.name} climbed the ladder from ${player.position} to ${destination}.`);
    await animateSpecialMove(currentPlayerIndex, "ladder", player.position, destination);
  } else if (snakes[player.position]) {
    const destination = snakes[player.position];
    addLogEntry(`${player.name} slid down the snake from ${player.position} to ${destination}.`);
    await animateSpecialMove(currentPlayerIndex, "snake", player.position, destination);
  }

  if (player.position === 100) {
    gameOver = true;
    isAnimating = false;
    addLogEntry(`${player.name} wins the game!`, true);
    updateSidebar();
    updateControlState();
    updateTokenPositions();
    return;
  }

  isAnimating = false;
  updateSidebar();
  updateControlState();
  switchTurn();
}

function resetGame() {
  if (cpuTurnTimer) {
    window.clearTimeout(cpuTurnTimer);
    cpuTurnTimer = null;
  }

  players[1].tokenEl.classList.remove("thinking");

  players.forEach((player) => {
    player.position = 1;
  });

  currentPlayerIndex = 0;
  gameOver = false;
  isAnimating = false;
  diceFace.textContent = "1";
  logList.innerHTML = "";
  addLogEntry(`New game started. ${players[0].name} goes first.`, true);
  refreshBoardVisuals();
  updateSidebar();
  updateControlState();
}

function handleResize() {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    refreshBoardVisuals();
  }, 80);
}

createBoard();
createTokens();
setGameMode("human");
applySettings(false);
refreshBoardVisuals();
resetGame();

rollButton.addEventListener("click", takeTurn);
resetButton.addEventListener("click", resetGame);
applySettingsButton.addEventListener("click", () => applySettings(true));
modeHumanButton.addEventListener("click", () => setGameMode("human"));
modeCpuButton.addEventListener("click", () => setGameMode("cpu"));
window.addEventListener("resize", handleResize);
