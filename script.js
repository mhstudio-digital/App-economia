/* ============================================================
   SANTAMARÍA RUNNER
   Juego web tipo "dino runner" con temática costarricense.
   HTML + CSS + JavaScript puro. Sin dependencias.
   Homenaje respetuoso a Juan Santamaría, héroe nacional de C.R.
   ============================================================ */

(() => {
  "use strict";

  /* ----------------------------------------------------------
     0. REFERENCIAS Y CONSTANTES
  ---------------------------------------------------------- */
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const W = canvas.width;     // 960 (resolución interna fija)
  const H = canvas.height;    // 400
  const GROUND_Y = 322;       // línea del suelo (donde apoyan los pies)
  const GRAVITY = 0.86;
  const JUMP_V = -15.6;
  const PLAYER_X = 120;
  const PLAYER_W = 42;
  const H_STAND = 70;
  const H_DUCK = 40;
  const TOTAL_LEVELS = 15;

  const LS_BEST = "santamaria_best";
  const LS_MAXLEVEL = "santamaria_maxlevel";

  // Estados del juego
  const S = {
    START: "start",
    PLAYING: "playing",
    PAUSED: "paused",
    GAMEOVER: "gameover",
    BURNING: "burning",
    LEVELCOMPLETE: "levelcomplete",
    VICTORY: "victory",
  };

  /* ----------------------------------------------------------
     1. ESTADO GLOBAL
  ---------------------------------------------------------- */
  const game = {
    state: S.START,
    level: 1,
    score: 0,
    best: loadInt(LS_BEST, 0),
    maxLevel: clamp(loadInt(LS_MAXLEVEL, 1), 1, TOTAL_LEVELS),

    speed: 5,
    distance: 0,         // distancia recorrida en el nivel actual
    worldX: 0,           // distancia total para el parallax/fondo
    cfg: null,           // configuración del nivel actual

    spawnTimer: 60,
    coinTimer: 120,

    obstacles: [],
    collectibles: [],
    particles: [],

    meson: null,         // objeto del Mesón (aparece al final del nivel)
    mesonReached: false,
    burnTimer: 0,
    levelBonus: 0,

    shieldHits: 0,       // golpes que absorbe el escudo
    invuln: 0,           // frames de invulnerabilidad tras recibir golpe
    shakeT: 0,           // sacudida de pantalla

    lastTime: 0,
    rafId: null,
  };

  const player = {
    y: GROUND_Y - H_STAND,
    vy: 0,
    h: H_STAND,
    grounded: true,
    ducking: false,
    runT: 0,             // animación de correr
    alive: true,
  };

  const input = { jumpHeld: false, duckHeld: false };

  /* ----------------------------------------------------------
     2. UTILIDADES
  ---------------------------------------------------------- */
  function loadInt(key, def) {
    const v = parseInt(localStorage.getItem(key), 10);
    return Number.isFinite(v) ? v : def;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[randi(0, arr.length - 1)]; }
  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /* ----------------------------------------------------------
     3. CONFIGURACIÓN DE NIVELES (15, escalando dificultad)
  ---------------------------------------------------------- */
  function levelConfig(n) {
    n = clamp(n, 1, TOTAL_LEVELS);
    const t = n - 1;

    // Tipos de obstáculos disponibles según el nivel
    const types = ["barril", "roca", "caja"];
    if (n >= 2) types.push("tronco");
    if (n >= 3) types.push("fuego");
    if (n >= 4) types.push("pozo");      // camino roto
    if (n >= 5) types.push("humo");

    return {
      level: n,
      distance: 1600 + t * 240,                 // meta del nivel
      speed: 5.0 + t * 0.45,                     // velocidad base
      spawnMin: Math.max(58 - t * 2.0, 30),      // frames mínimos entre obstáculos
      spawnMax: Math.max(102 - t * 3.2, 56),
      birds: n >= 6,                             // aves desde nivel 6
      doubleChance: n >= 8 ? clamp((n - 7) * 0.06, 0, 0.5) : 0, // obstáculos dobles
      types,
    };
  }

  /* ----------------------------------------------------------
     4. ARRANQUE / TRANSICIONES DE NIVEL
  ---------------------------------------------------------- */
  function startGame(fromLevel) {
    game.level = clamp(fromLevel || 1, 1, TOTAL_LEVELS);
    game.score = 0;
    setupLevel(game.level, true);
    setState(S.PLAYING);
    hideAllScreens();
    syncHUD();
  }

  function setupLevel(n, resetPlayer) {
    game.cfg = levelConfig(n);
    game.speed = game.cfg.speed;
    game.distance = 0;
    game.obstacles.length = 0;
    game.collectibles.length = 0;
    game.particles.length = 0;
    game.meson = null;
    game.mesonReached = false;
    game.burnTimer = 0;
    game.levelBonus = 0;
    game.spawnTimer = 70;
    game.coinTimer = 90;
    game.invuln = 60;
    game.shakeT = 0;

    if (resetPlayer) {
      game.shieldHits = 0;
    }
    // Reinicio del personaje
    player.y = GROUND_Y - H_STAND;
    player.vy = 0;
    player.h = H_STAND;
    player.grounded = true;
    player.ducking = false;
    player.alive = true;
  }

  function setState(s) { game.state = s; updateTouchControls(); }

  /* ----------------------------------------------------------
     5. ENTRADA (teclado y táctil)
  ---------------------------------------------------------- */
  function doJump() {
    if (game.state !== S.PLAYING) return;
    if (player.grounded) {
      player.vy = JUMP_V;
      player.grounded = false;
      player.ducking = false;
    }
  }
  function setDuck(on) {
    if (game.state !== S.PLAYING) return;
    input.duckHeld = on;
  }

  window.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === " " || k === "ArrowUp" || k === "w" || k === "W") {
      e.preventDefault();
      if (!input.jumpHeld) doJump();
      input.jumpHeld = true;
    } else if (k === "ArrowDown" || k === "s" || k === "S") {
      e.preventDefault();
      setDuck(true);
    } else if (k === "p" || k === "P" || k === "Escape") {
      togglePause();
    } else if (k === "Enter") {
      // Atajo: avanzar pantallas con Enter
      handleEnter();
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = e.key;
    if (k === " " || k === "ArrowUp" || k === "w" || k === "W") input.jumpHeld = false;
    if (k === "ArrowDown" || k === "s" || k === "S") setDuck(false);
  });

  // Toque en el lienzo: arriba = saltar, abajo = agacharse
  function pointerY(ev) {
    const r = canvas.getBoundingClientRect();
    const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
    return cy / r.height; // 0..1
  }
  canvas.addEventListener("touchstart", (e) => {
    if (game.state !== S.PLAYING) return;
    e.preventDefault();
    if (pointerY(e) > 0.62) setDuck(true); else doJump();
  }, { passive: false });
  canvas.addEventListener("touchend", (e) => { setDuck(false); }, { passive: false });

  // Botones táctiles dedicados
  const btnJump = document.getElementById("btn-jump");
  const btnDuck = document.getElementById("btn-duck");
  function bindHold(el, onDown, onUp) {
    el.addEventListener("touchstart", (e) => { e.preventDefault(); onDown(); }, { passive: false });
    el.addEventListener("touchend", (e) => { e.preventDefault(); onUp && onUp(); }, { passive: false });
    el.addEventListener("mousedown", (e) => { e.preventDefault(); onDown(); });
    el.addEventListener("mouseup", () => onUp && onUp());
    el.addEventListener("mouseleave", () => onUp && onUp());
  }
  bindHold(btnJump, doJump);
  bindHold(btnDuck, () => setDuck(true), () => setDuck(false));

  function updateTouchControls() {
    const tc = document.getElementById("touch-controls");
    tc.style.visibility = game.state === S.PLAYING ? "visible" : "hidden";
  }

  /* ----------------------------------------------------------
     6. SPAWN DE OBSTÁCULOS Y COLECCIONABLES
  ---------------------------------------------------------- */
  // Definición de tipos de obstáculos terrestres (tamaños de colisión)
  const OBST_DEF = {
    barril: { w: 30, h: 42 },
    roca:   { w: 40, h: 30 },
    caja:   { w: 34, h: 34 },
    tronco: { w: 64, h: 24 },
    fuego:  { w: 30, h: 46 },
    humo:   { w: 44, h: 40 },
    pozo:   { w: 58, h: 26 },
  };

  function spawnObstacle() {
    const cfg = game.cfg;
    let type = pick(cfg.types);

    // Aves (vuelan): alta -> no saltar; baja -> saltar
    if (cfg.birds && Math.random() < 0.26) {
      const high = Math.random() < 0.5;
      game.obstacles.push({
        kind: "bird",
        type: high ? "ave_alta" : "ave_baja",
        x: W + 30,
        y: high ? GROUND_Y - 122 : GROUND_Y - 64,
        w: 40, h: 26,
        wingT: Math.random() * Math.PI * 2,
        vx: game.speed * 1.12,
      });
      return;
    }

    const d = OBST_DEF[type];
    const baseY = type === "humo" ? GROUND_Y - d.h - rand(6, 26) : GROUND_Y - d.h;
    game.obstacles.push({
      kind: "ground",
      type,
      x: W + 20,
      y: baseY,
      w: d.w,
      h: d.h,
      animT: Math.random() * 10,
    });

    // Obstáculo doble en niveles altos (más juntos)
    if (Math.random() < cfg.doubleChance) {
      const t2 = pick(cfg.types);
      const d2 = OBST_DEF[t2];
      game.obstacles.push({
        kind: "ground", type: t2,
        x: W + 20 + d.w + rand(40, 70),
        y: GROUND_Y - d2.h, w: d2.w, h: d2.h, animT: Math.random() * 10,
      });
    }
  }

  function spawnCollectible() {
    const r = Math.random();
    let type, w, h, points;
    if (r < 0.12) { type = "escudo"; w = 30; h = 34; points = 120; }
    else if (r < 0.40) { type = "bandera"; w = 26; h = 32; points = 150; }
    else { type = "moneda"; w = 26; h = 26; points = 60; }

    // Patrón: a veces un arco de monedas que obliga a saltar
    if (type === "moneda" && Math.random() < 0.5) {
      const count = randi(3, 5);
      const startX = W + 30;
      for (let i = 0; i < count; i++) {
        const px = startX + i * 42;
        const arc = Math.sin((i / (count - 1)) * Math.PI); // 0..1..0
        const py = GROUND_Y - 60 - arc * 70;
        game.collectibles.push({ type: "moneda", x: px, y: py, w, h, points, spinT: Math.random() * 6, taken: false });
      }
      return;
    }

    const py = GROUND_Y - h - rand(18, 96);
    game.collectibles.push({ type, x: W + 30, y: py, w, h, points, spinT: Math.random() * 6, taken: false });
  }

  function spawnMeson() {
    game.meson = {
      x: W + 120,
      w: 168,
      h: 150,
      onFire: false,
    };
  }

  /* ----------------------------------------------------------
     7. PARTÍCULAS (fuego, chispas, polvo)
  ---------------------------------------------------------- */
  function addFireParticle(x, y, scale = 1) {
    game.particles.push({
      x, y,
      vx: rand(-0.8, 0.8),
      vy: rand(-2.4, -0.8) * scale,
      life: rand(18, 40),
      max: 40,
      r: rand(3, 7) * scale,
      kind: "fire",
    });
  }
  function addSpark(x, y) {
    for (let i = 0; i < 10; i++) {
      game.particles.push({
        x, y,
        vx: rand(-3, 3), vy: rand(-4, 1),
        life: rand(14, 28), max: 28,
        r: rand(2, 4), kind: "spark",
      });
    }
  }
  function updateParticles() {
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.kind === "fire") p.vy -= 0.04;
      if (p.kind === "spark") p.vy += 0.22;
      p.life--;
      if (p.life <= 0) game.particles.splice(i, 1);
    }
  }

  /* ----------------------------------------------------------
     8. ACTUALIZACIÓN PRINCIPAL
  ---------------------------------------------------------- */
  function update(dt) {
    if (game.state === S.PLAYING) updatePlaying(dt);
    else if (game.state === S.BURNING) updateBurning(dt);
    updateParticles();
    if (game.shakeT > 0) game.shakeT--;

    // Pasto de la antorcha siempre humeando un poco
    if (game.state === S.PLAYING || game.state === S.BURNING) {
      if (Math.random() < 0.7) {
        const t = torchTip();
        addFireParticle(t.x, t.y, 0.8);
      }
    }
  }

  function updatePlaying(dt) {
    const cfg = game.cfg;
    game.speed = cfg.speed + game.distance / 4200; // acelera ligeramente dentro del nivel
    const sp = game.speed;

    game.distance += sp;
    game.worldX += sp;
    game.score += sp * 0.10;

    if (game.invuln > 0) game.invuln--;

    // --- Física del jugador ---
    player.ducking = input.duckHeld && player.grounded;
    player.h = player.ducking ? H_DUCK : H_STAND;
    player.vy += GRAVITY;
    player.y += player.vy;
    if (player.y + player.h >= GROUND_Y) {
      player.y = GROUND_Y - player.h;
      player.vy = 0;
      player.grounded = true;
    } else {
      player.grounded = false;
    }
    if (player.grounded) player.runT += sp * 0.06;

    // --- ¿Toca aparecer el Mesón? ---
    const progress = game.distance / cfg.distance;
    if (!game.meson && progress >= 0.88) {
      spawnMeson();
    }

    // --- Spawns (solo si aún no apareció el Mesón) ---
    if (!game.meson) {
      game.spawnTimer -= 1;
      if (game.spawnTimer <= 0) {
        spawnObstacle();
        game.spawnTimer = rand(cfg.spawnMin, cfg.spawnMax);
      }
      game.coinTimer -= 1;
      if (game.coinTimer <= 0) {
        spawnCollectible();
        game.coinTimer = rand(90, 170);
      }
    }

    // --- Mover obstáculos ---
    for (let i = game.obstacles.length - 1; i >= 0; i--) {
      const o = game.obstacles[i];
      o.x -= o.kind === "bird" ? o.vx : sp;
      if (o.kind === "bird") o.wingT += 0.3;
      if (o.type === "fuego" || o.type === "humo") o.animT += 0.25;
      if (o.x + o.w < -40) { game.obstacles.splice(i, 1); continue; }

      // Colisión
      if (game.invuln <= 0 && hitsPlayer(o)) {
        takeHit();
        if (!player.alive) return;
        // tras el golpe con escudo, eliminamos el obstáculo para no encadenar
        game.obstacles.splice(i, 1);
      }
    }

    // --- Mover coleccionables ---
    for (let i = game.collectibles.length - 1; i >= 0; i--) {
      const c = game.collectibles[i];
      c.x -= sp;
      c.spinT += 0.12;
      if (c.x + c.w < -30) { game.collectibles.splice(i, 1); continue; }
      if (!c.taken && aabb(playerBox(), c)) {
        c.taken = true;
        collect(c);
        game.collectibles.splice(i, 1);
      }
    }

    // --- Mover Mesón y detectar llegada ---
    if (game.meson) {
      game.meson.x -= sp;
      const reachX = PLAYER_X + PLAYER_W + 8;
      if (game.meson.x <= reachX) {
        game.meson.x = reachX;
        beginBurning();
      }
    }

    syncHUD();
  }

  function hitsPlayer(o) {
    const pb = playerBox();
    // Las aves usan caja un poco más indulgente
    if (o.kind === "bird") {
      const b = { x: o.x + 5, y: o.y + 5, w: o.w - 10, h: o.h - 8 };
      return aabb(pb, b);
    }
    // El pozo (camino roto) solo golpea si el jugador está en el suelo sobre él
    if (o.type === "pozo") {
      const b = { x: o.x + 6, y: GROUND_Y - 6, w: o.w - 12, h: 8 };
      return player.grounded && aabb(pb, b);
    }
    const b = { x: o.x + 4, y: o.y + 3, w: o.w - 8, h: o.h - 5 };
    return aabb(pb, b);
  }

  function playerBox() {
    return { x: PLAYER_X + 6, y: player.y + 4, w: PLAYER_W - 12, h: player.h - 6 };
  }

  function takeHit() {
    if (game.shieldHits > 0) {
      game.shieldHits--;
      game.invuln = 80;
      game.shakeT = 10;
      const pb = playerBox();
      addSpark(pb.x + pb.w / 2, pb.y + pb.h / 2);
      syncHUD();
      return;
    }
    // Game over
    player.alive = false;
    game.shakeT = 22;
    const pb = playerBox();
    addSpark(pb.x + pb.w / 2, pb.y + pb.h / 2);
    endGame();
  }

  function collect(c) {
    game.score += c.points;
    if (c.type === "escudo") game.shieldHits = Math.min(game.shieldHits + 1, 3);
    addSpark(c.x + c.w / 2, c.y + c.h / 2);
    syncHUD();
  }

  /* --- Secuencia de quema del Mesón --- */
  function beginBurning() {
    if (game.state === S.BURNING) return;
    setState(S.BURNING);
    game.mesonReached = true;
    game.burnTimer = 0;
    player.ducking = false;
    player.h = H_STAND;
    player.y = GROUND_Y - H_STAND;
    player.vy = 0;
    player.grounded = true;
  }

  function updateBurning(dt) {
    game.burnTimer++;
    const m = game.meson;
    // Tras un instante, el Mesón se enciende
    if (game.burnTimer === 28) m.onFire = true;
    if (m.onFire) {
      // Generar fuego sobre el Mesón
      const intensity = clamp((game.burnTimer - 28) / 60, 0, 1);
      const n = Math.floor(2 + intensity * 8);
      for (let i = 0; i < n; i++) {
        addFireParticle(m.x + rand(10, m.w - 10), GROUND_Y - rand(20, m.h - 10), 1 + intensity);
      }
      if (game.burnTimer % 14 === 0) game.shakeT = 6;
    }
    // Fin de la animación -> nivel completado / victoria
    if (game.burnTimer >= 150) {
      completeLevel();
    }
  }

  /* ----------------------------------------------------------
     9. FIN DE NIVEL / FIN DE JUEGO + localStorage
  ---------------------------------------------------------- */
  function completeLevel() {
    // Bono por completar nivel
    game.levelBonus = 300 + game.level * 120;
    game.score += game.levelBonus;
    game.score = Math.floor(game.score);

    // Guardar progreso
    if (game.level + 1 > game.maxLevel) {
      game.maxLevel = clamp(game.level + 1, 1, TOTAL_LEVELS);
      localStorage.setItem(LS_MAXLEVEL, String(game.maxLevel));
    }
    saveBest();

    if (game.level >= TOTAL_LEVELS) {
      // Victoria final
      game.maxLevel = TOTAL_LEVELS;
      localStorage.setItem(LS_MAXLEVEL, String(TOTAL_LEVELS));
      setState(S.VICTORY);
      document.getElementById("vic-score").textContent = fmt(game.score);
      document.getElementById("vic-best").textContent = fmt(game.best);
      showScreen("screen-victory");
    } else {
      setState(S.LEVELCOMPLETE);
      document.getElementById("lc-level").textContent = game.level;
      document.getElementById("lc-score").textContent = fmt(game.score);
      document.getElementById("lc-bonus").textContent = "+" + fmt(game.levelBonus);
      document.getElementById("lc-msg").textContent = pick(LEVEL_MSGS);
      showScreen("screen-levelcomplete");
    }
  }

  function endGame() {
    game.score = Math.floor(game.score);
    saveBest();
    if (game.level > game.maxLevel) {
      game.maxLevel = game.level;
      localStorage.setItem(LS_MAXLEVEL, String(game.maxLevel));
    }
    setState(S.GAMEOVER);
    document.getElementById("go-score").textContent = fmt(game.score);
    document.getElementById("go-best").textContent = fmt(game.best);
    document.getElementById("go-level").textContent = game.level;
    document.getElementById("gameover-msg").textContent = pick(GAMEOVER_MSGS);
    showScreen("screen-gameover");
  }

  function saveBest() {
    if (game.score > game.best) {
      game.best = game.score;
      localStorage.setItem(LS_BEST, String(game.best));
    }
  }

  const LEVEL_MSGS = [
    "El Mesón arde. ¡Por la libertad!",
    "Una victoria más para la patria.",
    "La antorcha ilumina el camino.",
    "El pueblo celebra tu valentía.",
    "Adelante, héroe. La gesta continúa.",
  ];
  const GAMEOVER_MSGS = [
    "El héroe cayó, pero la gesta continúa.",
    "La llama se apagó… por ahora.",
    "Levantate y volvé a intentarlo.",
    "Costa Rica confía en vos. ¡De nuevo!",
  ];

  /* ----------------------------------------------------------
     10. RENDER (todo dibujado con canvas)
  ---------------------------------------------------------- */
  function render() {
    ctx.save();
    if (game.shakeT > 0) {
      const s = game.shakeT;
      ctx.translate(rand(-s, s) * 0.5, rand(-s, s) * 0.5);
    }
    drawSky();
    drawMountains();
    drawHillsAndTrees();
    drawHouses();
    drawGround();
    drawCollectibles();
    drawMeson();
    drawObstacles();
    drawPlayer();
    drawParticles();
    ctx.restore();
  }

  // --- Cielo con sol ---
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, "#aee6ff");
    g.addColorStop(0.55, "#8fd4f2");
    g.addColorStop(1, "#cfeedd");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // Sol
    ctx.save();
    ctx.globalAlpha = 0.95;
    const sun = ctx.createRadialGradient(W - 150, 78, 8, W - 150, 78, 60);
    sun.addColorStop(0, "#fff6c8");
    sun.addColorStop(1, "rgba(255,225,120,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(W - 230, 0, 180, 160);
    ctx.fillStyle = "#fff2b0";
    ctx.beginPath(); ctx.arc(W - 150, 78, 30, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Nubes (parallax muy lento)
    const off = (game.worldX * 0.08) % 480;
    drawCloud(120 - off, 70, 1.0);
    drawCloud(360 - off, 110, 0.8);
    drawCloud(620 - off, 60, 1.1);
    drawCloud(820 - off, 120, 0.7);
    drawCloud(120 + 480 - off, 70, 1.0);
    drawCloud(360 + 480 - off, 110, 0.8);
  }
  function drawCloud(x, y, s) {
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.beginPath();
    ctx.arc(x, y, 18 * s, 0, Math.PI * 2);
    ctx.arc(x + 22 * s, y - 6 * s, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 48 * s, y, 18 * s, 0, Math.PI * 2);
    ctx.arc(x + 24 * s, y + 8 * s, 20 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Montañas (verde, parallax lento) con un volcán ---
  function drawMountains() {
    const baseY = GROUND_Y;
    const off = (game.worldX * 0.18) % 520;
    for (let k = -1; k < 3; k++) {
      const bx = k * 520 - off;
      // Cadena de montañas
      ctx.fillStyle = "#3f8f5b";
      mountain(bx + 40, baseY, 220, 150);
      mountain(bx + 230, baseY, 280, 190);
      ctx.fillStyle = "#347a4d";
      mountain(bx + 150, baseY, 250, 120);
      // Volcán con humito
      drawVolcano(bx + 380, baseY, 200, 170);
    }
  }
  function mountain(cx, baseY, w, h) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, baseY);
    ctx.lineTo(cx, baseY - h);
    ctx.lineTo(cx + w / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }
  function drawVolcano(cx, baseY, w, h) {
    ctx.fillStyle = "#2c6b43";
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, baseY);
    ctx.lineTo(cx - 22, baseY - h);
    ctx.lineTo(cx + 22, baseY - h);
    ctx.lineTo(cx + w / 2, baseY);
    ctx.closePath();
    ctx.fill();
    // cráter
    ctx.fillStyle = "#264f36";
    ctx.fillRect(cx - 22, baseY - h, 44, 8);
    // humito
    ctx.fillStyle = "rgba(220,220,220,.5)";
    const t = game.worldX * 0.02;
    for (let i = 0; i < 3; i++) {
      const yy = baseY - h - 14 - i * 16;
      ctx.beginPath();
      ctx.arc(cx + Math.sin(t + i) * 8, yy, 8 + i * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Colinas cercanas + árboles ---
  function drawHillsAndTrees() {
    const off = (game.worldX * 0.4) % 360;
    for (let k = -1; k < 4; k++) {
      const bx = k * 360 - off;
      ctx.fillStyle = "#4fae6a";
      ctx.beginPath();
      ctx.moveTo(bx, GROUND_Y);
      ctx.quadraticCurveTo(bx + 90, GROUND_Y - 70, bx + 180, GROUND_Y);
      ctx.closePath();
      ctx.fill();
      drawTree(bx + 60, GROUND_Y - 18, 1);
      drawTree(bx + 250, GROUND_Y - 14, 0.85);
    }
  }
  function drawTree(x, baseY, s) {
    ctx.fillStyle = "#7a4a24";
    ctx.fillRect(x - 4 * s, baseY - 34 * s, 8 * s, 34 * s);
    ctx.fillStyle = "#2f8a4a";
    ctx.beginPath();
    ctx.arc(x, baseY - 44 * s, 20 * s, 0, Math.PI * 2);
    ctx.arc(x - 16 * s, baseY - 34 * s, 15 * s, 0, Math.PI * 2);
    ctx.arc(x + 16 * s, baseY - 34 * s, 15 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3aa15a";
    ctx.beginPath();
    ctx.arc(x - 6 * s, baseY - 48 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Casas típicas (adobe blanco, techo de teja) ---
  const HOUSE_COLORS = ["#fff4e2", "#ffe6c0", "#f6d9b8", "#ffeede", "#eaf4ff"];
  function drawHouses() {
    const tile = 250;
    const off = (game.worldX * 0.62) % tile;
    for (let k = -1; k < Math.ceil(W / tile) + 1; k++) {
      const bx = k * tile - off;
      // semilla estable por casa para que no cambie de color al desplazarse
      const seed = Math.floor((game.worldX * 0.62 + k * tile) / tile);
      drawHouse(bx + 30, GROUND_Y, seed);
    }
  }
  function drawHouse(x, baseY, seed) {
    const colorIdx = Math.abs(seed) % HOUSE_COLORS.length;
    const wide = 92 + (Math.abs(seed * 37) % 38);
    const wallH = 70 + (Math.abs(seed * 17) % 24);
    const wallY = baseY - wallH;

    // pared
    ctx.fillStyle = HOUSE_COLORS[colorIdx];
    ctx.fillRect(x, wallY, wide, wallH);
    // zócalo
    ctx.fillStyle = "rgba(0,0,0,.08)";
    ctx.fillRect(x, baseY - 10, wide, 10);

    // techo de teja
    const eave = 12;
    const roofH = 30;
    ctx.fillStyle = "#c0492f";
    ctx.beginPath();
    ctx.moveTo(x - eave, wallY);
    ctx.lineTo(x + wide / 2, wallY - roofH);
    ctx.lineTo(x + wide + eave, wallY);
    ctx.closePath();
    ctx.fill();
    // líneas de teja
    ctx.strokeStyle = "rgba(120,40,20,.45)";
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const yy = wallY - (roofH * i) / 4;
      const half = (wide / 2 + eave) * (1 - i / 4);
      ctx.beginPath();
      ctx.moveTo(x + wide / 2 - half, yy);
      ctx.lineTo(x + wide / 2 + half, yy);
      ctx.stroke();
    }

    // puerta
    const dw = 22, dh = 38;
    ctx.fillStyle = "#7a4a24";
    ctx.fillRect(x + wide / 2 - dw / 2, baseY - dh, dw, dh);
    ctx.fillStyle = "#5e3a1e";
    ctx.fillRect(x + wide / 2 - 1, baseY - dh, 2, dh);
    // ventana
    ctx.fillStyle = "#bfe3ff";
    ctx.fillRect(x + 12, wallY + 16, 20, 18);
    ctx.strokeStyle = "#7a4a24"; ctx.lineWidth = 3;
    ctx.strokeRect(x + 12, wallY + 16, 20, 18);
    ctx.beginPath();
    ctx.moveTo(x + 22, wallY + 16); ctx.lineTo(x + 22, wallY + 34);
    ctx.moveTo(x + 12, wallY + 25); ctx.lineTo(x + 32, wallY + 25);
    ctx.stroke();
  }

  // --- Suelo: camino de tierra ---
  function drawGround() {
    // franja de pasto
    ctx.fillStyle = "#46a85f";
    ctx.fillRect(0, GROUND_Y - 6, W, 8);
    // tierra
    const g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    g.addColorStop(0, "#a06a3c");
    g.addColorStop(1, "#6e4524");
    ctx.fillStyle = g;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // textura del camino (piedritas / surcos en movimiento)
    const off = game.worldX % 60;
    ctx.strokeStyle = "rgba(60,35,15,.35)";
    ctx.lineWidth = 3;
    for (let x = -off; x < W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 18);
      ctx.lineTo(x + 26, GROUND_Y + 18);
      ctx.stroke();
    }
    // piedritas
    const off2 = (game.worldX * 1.0) % 90;
    ctx.fillStyle = "rgba(255,240,220,.35)";
    for (let x = -off2; x < W; x += 90) {
      ctx.beginPath(); ctx.arc(x + 20, GROUND_Y + 40, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 60, GROUND_Y + 56, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "rgba(40,22,10,.35)";
    for (let x = -off2; x < W; x += 90) {
      ctx.beginPath(); ctx.arc(x + 40, GROUND_Y + 30, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // --- Coleccionables ---
  function drawCollectibles() {
    for (const c of game.collectibles) {
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      if (c.type === "moneda") drawCoin(cx, cy, c.spinT);
      else if (c.type === "bandera") drawFlag(c.x, c.y, c.spinT);
      else if (c.type === "escudo") drawShield(cx, cy, c.spinT);
    }
  }
  function drawCoin(cx, cy, t) {
    const sx = Math.abs(Math.cos(t)) * 0.85 + 0.15; // efecto de giro
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sx, 1);
    ctx.fillStyle = "#ffcf3f";
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#c79318"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = "#e6a91f";
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // brillo
    ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.beginPath(); ctx.arc(cx - 3 * sx, cy - 4, 2, 0, Math.PI * 2); ctx.fill();
  }
  function drawFlag(x, y, t) {
    const sway = Math.sin(t) * 2;
    // mástil
    ctx.fillStyle = "#7a4a24";
    ctx.fillRect(x, y, 3, 32);
    // bandera CR: azul-blanco-rojo-blanco-azul
    const fx = x + 3, fy = y + 2, fw = 22, fh = 14;
    const bands = ["#0b3d91", "#ffffff", "#ce1126", "#ffffff", "#0b3d91"];
    const hs = [0.2, 0.15, 0.3, 0.15, 0.2];
    let yy = fy;
    for (let i = 0; i < bands.length; i++) {
      const bh = fh * hs[i];
      ctx.fillStyle = bands[i];
      ctx.beginPath();
      ctx.moveTo(fx, yy);
      ctx.lineTo(fx + fw, yy + sway);
      ctx.lineTo(fx + fw, yy + sway + bh);
      ctx.lineTo(fx, yy + bh);
      ctx.closePath();
      ctx.fill();
      yy += bh;
    }
  }
  function drawShield(cx, cy, t) {
    const pulse = 1 + Math.sin(t * 1.5) * 0.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#2e9c54";
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(13, -9);
    ctx.lineTo(13, 4);
    ctx.quadraticCurveTo(0, 18, 0, 18);
    ctx.quadraticCurveTo(-13, 9, -13, 4);
    ctx.lineTo(-13, -9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6, -5); ctx.lineTo(6, 3);
    ctx.quadraticCurveTo(0, 10, 0, 10);
    ctx.quadraticCurveTo(-6, 3, -6, 3); ctx.lineTo(-6, -5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // --- Obstáculos ---
  function drawObstacles() {
    for (const o of game.obstacles) {
      if (o.kind === "bird") { drawBird(o); continue; }
      switch (o.type) {
        case "barril": drawBarrel(o); break;
        case "roca": drawRock(o); break;
        case "caja": drawCrate(o); break;
        case "tronco": drawLog(o); break;
        case "fuego": drawFireObstacle(o); break;
        case "humo": drawSmoke(o); break;
        case "pozo": drawPit(o); break;
      }
    }
  }
  function drawBarrel(o) {
    ctx.fillStyle = "#9c5a2a";
    roundRect(o.x, o.y, o.w, o.h, 6, true);
    ctx.fillStyle = "#7a431d";
    ctx.fillRect(o.x, o.y + o.h * 0.28, o.w, 4);
    ctx.fillRect(o.x, o.y + o.h * 0.64, o.w, 4);
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.fillRect(o.x + 4, o.y + 4, 6, o.h - 8);
  }
  function drawRock(o) {
    ctx.fillStyle = "#8a9098";
    ctx.beginPath();
    ctx.moveTo(o.x, o.y + o.h);
    ctx.lineTo(o.x + o.w * 0.18, o.y + o.h * 0.35);
    ctx.lineTo(o.x + o.w * 0.5, o.y);
    ctx.lineTo(o.x + o.w * 0.82, o.y + o.h * 0.4);
    ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.18)";
    ctx.beginPath();
    ctx.moveTo(o.x + o.w * 0.5, o.y);
    ctx.lineTo(o.x + o.w * 0.82, o.y + o.h * 0.4);
    ctx.lineTo(o.x + o.w * 0.6, o.y + o.h * 0.45);
    ctx.closePath(); ctx.fill();
  }
  function drawCrate(o) {
    ctx.fillStyle = "#b5803f";
    ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.strokeStyle = "#7a5223"; ctx.lineWidth = 3;
    ctx.strokeRect(o.x + 1.5, o.y + 1.5, o.w - 3, o.h - 3);
    ctx.beginPath();
    ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x, o.y + o.h);
    ctx.stroke();
  }
  function drawLog(o) {
    ctx.fillStyle = "#7a4a24";
    roundRect(o.x, o.y, o.w, o.h, 10, true);
    ctx.fillStyle = "#9c6433";
    ctx.beginPath(); ctx.ellipse(o.x + 10, o.y + o.h / 2, 8, o.h / 2 - 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#5e3a1e"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(o.x + 10, o.y + o.h / 2, 4, o.h / 2 - 6, 0, 0, Math.PI * 2); ctx.stroke();
  }
  function drawFireObstacle(o) {
    // base de leña
    ctx.fillStyle = "#5e3a1e";
    ctx.fillRect(o.x + 2, o.y + o.h - 8, o.w - 4, 8);
    // llamas
    flame(o.x + o.w / 2, o.y + o.h - 6, o.w * 0.8, o.h, o.animT);
  }
  function drawSmoke(o) {
    const t = o.animT;
    for (let i = 0; i < 4; i++) {
      const a = 0.18 + i * 0.06;
      ctx.fillStyle = `rgba(120,120,125,${0.5 - i * 0.08})`;
      ctx.beginPath();
      ctx.arc(o.x + 10 + i * 8 + Math.sin(t + i) * 3, o.y + o.h - 8 - i * 8, 12 - i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function drawPit(o) {
    // borde de tierra roto + hueco oscuro
    ctx.fillStyle = "#3a2410";
    ctx.fillRect(o.x, GROUND_Y, o.w, H - GROUND_Y);
    ctx.fillStyle = "#1c1208";
    ctx.fillRect(o.x + 4, GROUND_Y + 2, o.w - 8, 30);
    // bordes irregulares
    ctx.fillStyle = "#6e4524";
    ctx.beginPath();
    ctx.moveTo(o.x, GROUND_Y);
    ctx.lineTo(o.x + 8, GROUND_Y - 6);
    ctx.lineTo(o.x + 16, GROUND_Y);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(o.x + o.w, GROUND_Y);
    ctx.lineTo(o.x + o.w - 8, GROUND_Y - 6);
    ctx.lineTo(o.x + o.w - 16, GROUND_Y);
    ctx.closePath(); ctx.fill();
  }
  function drawBird(o) {
    const flap = Math.sin(o.wingT) * 10;
    ctx.fillStyle = "#3b3b46";
    // cuerpo
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // alas
    ctx.beginPath();
    ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2);
    ctx.lineTo(o.x + 2, o.y + o.h / 2 - flap);
    ctx.lineTo(o.x + o.w / 2 - 4, o.y + o.h / 2 + 2);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2);
    ctx.lineTo(o.x + o.w - 2, o.y + o.h / 2 - flap);
    ctx.lineTo(o.x + o.w / 2 + 4, o.y + o.h / 2 + 2);
    ctx.closePath(); ctx.fill();
    // pico
    ctx.fillStyle = "#e6a91f";
    ctx.beginPath();
    ctx.moveTo(o.x + o.w / 2 + 10, o.y + o.h / 2 - 2);
    ctx.lineTo(o.x + o.w / 2 + 18, o.y + o.h / 2);
    ctx.lineTo(o.x + o.w / 2 + 10, o.y + o.h / 2 + 2);
    ctx.closePath(); ctx.fill();
  }

  // --- Mesón ---
  function drawMeson(o) {
    const m = game.meson;
    if (!m) return;
    const baseY = GROUND_Y;
    const x = m.x, w = m.w, wallH = m.h - 40;
    const wallY = baseY - wallH;

    // sombra
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.fillRect(x - 4, baseY - 6, w + 8, 6);

    // pared (mesón = posada grande, adobe)
    ctx.fillStyle = "#efe1c6";
    ctx.fillRect(x, wallY, w, wallH);
    ctx.fillStyle = "rgba(0,0,0,.08)";
    ctx.fillRect(x, baseY - 12, w, 12);

    // techo grande de teja
    const eave = 18, roofH = 44;
    ctx.fillStyle = "#b5432c";
    ctx.beginPath();
    ctx.moveTo(x - eave, wallY);
    ctx.lineTo(x + w / 2, wallY - roofH);
    ctx.lineTo(x + w + eave, wallY);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(110,35,18,.5)"; ctx.lineWidth = 2;
    for (let i = 1; i < 5; i++) {
      const yy = wallY - (roofH * i) / 5;
      const half = (w / 2 + eave) * (1 - i / 5);
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - half, yy); ctx.lineTo(x + w / 2 + half, yy); ctx.stroke();
    }

    // puerta doble
    const dw = 44, dh = 64;
    ctx.fillStyle = "#6e4524";
    ctx.fillRect(x + w / 2 - dw / 2, baseY - dh, dw, dh);
    ctx.strokeStyle = "#4a2d15"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, baseY - dh); ctx.lineTo(x + w / 2, baseY); ctx.stroke();
    // ventanas
    ctx.fillStyle = "#caa46a";
    ctx.fillRect(x + 18, wallY + 18, 28, 26);
    ctx.fillRect(x + w - 46, wallY + 18, 28, 26);
    ctx.strokeStyle = "#6e4524"; ctx.lineWidth = 3;
    ctx.strokeRect(x + 18, wallY + 18, 28, 26);
    ctx.strokeRect(x + w - 46, wallY + 18, 28, 26);

    // letrero "MESÓN"
    ctx.fillStyle = "#5e3a1e";
    ctx.fillRect(x + w / 2 - 38, wallY - 2, 76, 18);
    ctx.fillStyle = "#ffe9b0";
    ctx.font = "bold 13px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MESÓN", x + w / 2, wallY + 11);
    ctx.textAlign = "left";

    // si está ardiendo, oscurecer un poco con resplandor (las partículas hacen el fuego)
    if (m.onFire) {
      const glow = ctx.createRadialGradient(x + w / 2, wallY, 10, x + w / 2, wallY, w);
      glow.addColorStop(0, "rgba(255,150,40,.35)");
      glow.addColorStop(1, "rgba(255,80,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 40, wallY - 60, w + 80, m.h + 60);
    }
  }

  // --- Jugador: Juan Santamaría con antorcha ---
  function drawPlayer() {
    if (!player.alive && game.state === S.GAMEOVER) {
      drawFallenPlayer();
      return;
    }
    const x = PLAYER_X;
    const topY = player.y;
    const h = player.h;
    const cx = x + PLAYER_W / 2;
    const ducking = player.ducking;

    const flash = game.invuln > 0 && Math.floor(game.invuln / 4) % 2 === 0;
    ctx.save();
    if (flash) ctx.globalAlpha = 0.45;

    // sombra en el suelo
    if (game.state !== S.GAMEOVER) {
      ctx.globalAlpha *= 1;
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.beginPath();
      ctx.ellipse(cx, GROUND_Y + 2, 20, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // animación de piernas
    const stride = player.grounded ? Math.sin(player.runT) : 0.6;
    const legY = topY + h;

    // proporciones
    const headR = 9;
    const bodyTop = topY + (ducking ? 6 : 14);
    const bodyBottom = legY - (ducking ? 8 : 18);

    // piernas (pantalón claro)
    ctx.strokeStyle = "#caa46a";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    if (game.state === S.PLAYING && player.grounded) {
      ctx.beginPath();
      ctx.moveTo(cx, bodyBottom);
      ctx.lineTo(cx - 6 + stride * 8, legY);
      ctx.moveTo(cx, bodyBottom);
      ctx.lineTo(cx + 6 - stride * 8, legY);
      ctx.stroke();
    } else {
      // saltando: piernas recogidas
      ctx.beginPath();
      ctx.moveTo(cx, bodyBottom);
      ctx.lineTo(cx - 7, legY - 4);
      ctx.moveTo(cx, bodyBottom);
      ctx.lineTo(cx + 7, legY - 2);
      ctx.stroke();
    }

    // torso (camisa blanca de soldado)
    ctx.fillStyle = "#fbf7ee";
    roundRect(cx - 9, bodyTop, 18, bodyBottom - bodyTop, 5, true);
    // banda/cinturón rojo (detalle costarricense)
    ctx.fillStyle = "#ce1126";
    ctx.fillRect(cx - 9, bodyBottom - 8, 18, 5);
    // tirante
    ctx.strokeStyle = "#c9a24a"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 7, bodyTop + 2); ctx.lineTo(cx + 6, bodyBottom - 8); ctx.stroke();

    // cabeza
    const headY = bodyTop - headR + 2;
    ctx.fillStyle = "#e8b487"; // tono de piel neutro
    ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI * 2); ctx.fill();
    // cabello
    ctx.fillStyle = "#3a2417";
    ctx.beginPath();
    ctx.arc(cx, headY - 1, headR, Math.PI * 1.05, Math.PI * 2.0);
    ctx.fill();
    ctx.fillRect(cx - headR, headY - 3, headR * 2, 3);

    // brazo derecho sostiene la antorcha en alto
    const handX = cx + 14;
    const handY = topY + (ducking ? -2 : -6);
    ctx.strokeStyle = "#e8b487"; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx + 6, bodyTop + 6);
    ctx.lineTo(handX, handY + 8);
    ctx.stroke();
    // brazo izquierdo balanceándose
    ctx.beginPath();
    ctx.moveTo(cx - 6, bodyTop + 8);
    ctx.lineTo(cx - 12 + stride * 6, bodyTop + 20);
    ctx.stroke();

    ctx.restore();

    // Antorcha (siempre a opacidad completa para que el fuego luzca)
    drawTorch(handX, handY);
  }

  function drawTorch(hx, hy) {
    // mango
    ctx.save();
    ctx.strokeStyle = "#6e4524";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(hx, hy + 14);
    ctx.lineTo(hx + 6, hy - 8);
    ctx.stroke();
    // copa metálica
    ctx.fillStyle = "#8a7a4a";
    ctx.fillRect(hx + 2, hy - 12, 8, 6);
    ctx.restore();
    // llama animada
    const t = game.worldX * 0.4 + performance.now() * 0.01;
    flame(hx + 6, hy - 10, 16, 26, t);
  }

  // Llama reutilizable (antorcha, fuego, mesón)
  function flame(cx, baseY, w, h, t) {
    const flick = Math.sin(t * 3) * 0.12 + Math.sin(t * 7.3) * 0.06;
    const hh = h * (1 + flick);
    // exterior (rojo/naranja)
    ctx.fillStyle = "#ff5a1f";
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, baseY);
    ctx.quadraticCurveTo(cx - w / 2 - 2, baseY - hh * 0.45, cx, baseY - hh);
    ctx.quadraticCurveTo(cx + w / 2 + 2, baseY - hh * 0.45, cx + w / 2, baseY);
    ctx.closePath(); ctx.fill();
    // medio (naranja claro)
    ctx.fillStyle = "#ff9b2e";
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.32, baseY);
    ctx.quadraticCurveTo(cx - w * 0.32, baseY - hh * 0.4, cx, baseY - hh * 0.72);
    ctx.quadraticCurveTo(cx + w * 0.32, baseY - hh * 0.4, cx + w * 0.32, baseY);
    ctx.closePath(); ctx.fill();
    // interior (amarillo)
    ctx.fillStyle = "#ffe27a";
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.16, baseY);
    ctx.quadraticCurveTo(cx - w * 0.16, baseY - hh * 0.32, cx, baseY - hh * 0.5);
    ctx.quadraticCurveTo(cx + w * 0.16, baseY - hh * 0.32, cx + w * 0.16, baseY);
    ctx.closePath(); ctx.fill();
  }

  function drawFallenPlayer() {
    const x = PLAYER_X, cx = x + PLAYER_W / 2;
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath(); ctx.ellipse(cx, GROUND_Y + 2, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
    // figura tumbada
    ctx.fillStyle = "#fbf7ee";
    roundRect(cx - 18, GROUND_Y - 16, 36, 14, 6, true);
    ctx.fillStyle = "#e8b487";
    ctx.beginPath(); ctx.arc(cx - 22, GROUND_Y - 10, 8, 0, Math.PI * 2); ctx.fill();
    // antorcha caída con humito
    ctx.strokeStyle = "#6e4524"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx + 16, GROUND_Y - 8); ctx.lineTo(cx + 34, GROUND_Y - 4); ctx.stroke();
  }

  function drawParticles() {
    for (const p of game.particles) {
      const a = p.life / p.max;
      if (p.kind === "fire") {
        ctx.fillStyle = `rgba(255,${Math.floor(120 + a * 120)},40,${a * 0.9})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a + 1, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255,210,90,${a})`;
        ctx.fillRect(p.x, p.y, p.r, p.r);
      }
    }
  }

  function torchTip() {
    // posición aproximada de la punta de la antorcha del jugador
    const cx = PLAYER_X + PLAYER_W / 2;
    const handX = cx + 14;
    const handY = player.y + (player.ducking ? -2 : -6);
    return { x: handX + 6, y: handY - 16 };
  }

  // Utilidad: rectángulo redondeado
  function roundRect(x, y, w, h, r, fill) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
  }

  /* ----------------------------------------------------------
     11. HUD Y PANTALLAS (DOM)
  ---------------------------------------------------------- */
  const ui = {
    score: document.getElementById("ui-score"),
    best: document.getElementById("ui-best"),
    level: document.getElementById("ui-level"),
    progress: document.getElementById("ui-progress"),
    progressFlame: document.getElementById("ui-progress-flame"),
    shield: document.getElementById("ui-shield"),
    shieldPill: document.getElementById("ui-shield-pill"),
  };

  function fmt(n) { return Math.floor(n).toLocaleString("es-CR"); }

  function syncHUD() {
    ui.score.textContent = fmt(game.score);
    ui.best.textContent = fmt(Math.max(game.best, game.score));
    ui.level.textContent = game.level;
    const prog = game.cfg ? clamp(game.distance / game.cfg.distance, 0, 1) : 0;
    ui.progress.style.width = (prog * 100).toFixed(1) + "%";
    ui.progressFlame.style.left = (prog * 100).toFixed(1) + "%";
    ui.shield.textContent = game.shieldHits;
    ui.shieldPill.classList.toggle("inactive", game.shieldHits === 0);
  }

  const screens = [
    "screen-start", "screen-howto", "screen-pause",
    "screen-gameover", "screen-levelcomplete", "screen-victory",
  ];
  function hideAllScreens() {
    screens.forEach((id) => document.getElementById(id).classList.remove("show"));
  }
  function showScreen(id) {
    hideAllScreens();
    document.getElementById(id).classList.add("show");
  }

  function refreshStartScreen() {
    document.getElementById("start-best").textContent = fmt(game.best);
    document.getElementById("start-maxlevel").textContent = game.maxLevel;
    const cont = document.getElementById("btn-continue");
    if (game.maxLevel > 1) {
      cont.classList.remove("hidden");
      document.getElementById("continue-level").textContent = game.maxLevel;
    } else {
      cont.classList.add("hidden");
    }
  }

  /* ----------------------------------------------------------
     12. CONTROL DE PAUSA Y BOTONES
  ---------------------------------------------------------- */
  function togglePause() {
    if (game.state === S.PLAYING) {
      setState(S.PAUSED);
      showScreen("screen-pause");
    } else if (game.state === S.PAUSED) {
      setState(S.PLAYING);
      hideAllScreens();
    }
  }

  function handleEnter() {
    // Permite avanzar con Enter en las pantallas
    switch (game.state) {
      case S.START: startGame(1); break;
      case S.GAMEOVER: startGame(game.level); break;
      case S.LEVELCOMPLETE: nextLevel(); break;
      case S.VICTORY: gotoMenu(); break;
      case S.PAUSED: togglePause(); break;
    }
  }

  function nextLevel() {
    game.level = clamp(game.level + 1, 1, TOTAL_LEVELS);
    setupLevel(game.level, false);
    setState(S.PLAYING);
    hideAllScreens();
    syncHUD();
  }

  function gotoMenu() {
    setState(S.START);
    refreshStartScreen();
    showScreen("screen-start");
  }

  // Enlazar botones
  document.getElementById("btn-play").addEventListener("click", () => startGame(1));
  document.getElementById("btn-continue").addEventListener("click", () => startGame(game.maxLevel));
  document.getElementById("btn-howto").addEventListener("click", () => showScreen("screen-howto"));
  document.getElementById("btn-howto-back").addEventListener("click", () => { refreshStartScreen(); showScreen("screen-start"); });
  document.getElementById("btn-pause").addEventListener("click", togglePause);
  document.getElementById("btn-resume").addEventListener("click", togglePause);
  document.getElementById("btn-restart-pause").addEventListener("click", () => { setupLevel(game.level, true); setState(S.PLAYING); hideAllScreens(); syncHUD(); });
  document.getElementById("btn-menu-pause").addEventListener("click", gotoMenu);
  document.getElementById("btn-retry").addEventListener("click", () => startGame(game.level));
  document.getElementById("btn-menu-go").addEventListener("click", gotoMenu);
  document.getElementById("btn-next").addEventListener("click", nextLevel);
  document.getElementById("btn-playagain").addEventListener("click", () => startGame(1));

  // Pausar al perder el foco de la pestaña
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === S.PLAYING) togglePause();
  });

  /* ----------------------------------------------------------
     13. BUCLE PRINCIPAL
  ---------------------------------------------------------- */
  // En menús y pantallas no jugables, el paisaje sigue desplazándose suave
  function ambientScroll() {
    // El paisaje sigue moviéndose en menús, pero se congela en pausa y en juego
    if (game.state === S.PLAYING || game.state === S.BURNING || game.state === S.PAUSED) return;
    game.worldX += 1.1;
  }

  // Timestep fijo: la lógica corre a 60 Hz sin importar la tasa de refresco
  const STEP = 1000 / 60;
  let accumulator = 0;
  function loop(time) {
    let delta = time - game.lastTime;
    game.lastTime = time;
    if (!Number.isFinite(delta) || delta < 0) delta = STEP;
    if (delta > 250) delta = 250; // evita saltos tras cambiar de pestaña
    accumulator += delta;
    let steps = 0;
    while (accumulator >= STEP && steps < 5) {
      ambientScroll();
      update(1);
      accumulator -= STEP;
      steps++;
    }
    render();
    game.rafId = requestAnimationFrame(loop);
  }

  /* ----------------------------------------------------------
     14. INICIALIZACIÓN
  ---------------------------------------------------------- */
  function init() {
    game.cfg = levelConfig(1);   // nivel "de fondo" para animar el menú
    game.worldX = 0;
    refreshStartScreen();
    showScreen("screen-start");
    updateTouchControls();
    syncHUD();
  }

  // Arranque: una sola animación
  window.addEventListener("load", () => {
    init();
    game.lastTime = performance.now();
    cancelAnimationFrame(game.rafId);
    game.rafId = requestAnimationFrame(loop);
  });
})();
