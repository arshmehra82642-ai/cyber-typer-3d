/**
 * CyberTyper 3D - Main Game Engine
 * Coordinates 3D Scene, Procedural Audio, Typing Mechanics, HUD, and Wave Progression.
 */

class CyberTyperGame {
  constructor() {
    this.audio = new SoundEngine();
    this.scene = new GameScene3D(document.getElementById('webgl-canvas'));
    this.scene.isDrivenExternally = true; // Unified 60fps/120fps lockstep loop
    this.wordContainer = document.getElementById('word-container');

    // Game State
    this.state = 'START'; // 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
    this.difficulty = 'cadet'; // 'cadet' | 'hacker' | 'overlord'
    
    // Stats & Counters
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('cybertyper_highscore') || '0', 10);
    this.combo = 1;
    this.maxCombo = 1;
    this.shields = 100;
    this.wordsDestroyed = 0;
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.startTime = null;
    this.peakWPM = 0;

    // Spawning & Enemies
    this.enemies = [];
    this.activeTarget = null;
    this.spawnTimer = 0;
    this.lastTime = performance.now();

    // DOM Elements
    this.cacheDOM();
    this.bindEvents();
    this.updateHUD();

    // Start Single Unified Animation Loop
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  cacheDOM() {
    this.dom = {
      scoreVal: document.getElementById('score-val'),
      comboBadge: document.getElementById('combo-badge'),
      comboVal: document.getElementById('combo-val'),
      wpmVal: document.getElementById('wpm-val'),
      accVal: document.getElementById('acc-val'),
      shieldBar: document.getElementById('shield-bar'),
      shieldVal: document.getElementById('shield-val'),
      btnMute: document.getElementById('btn-mute'),
      btnPause: document.getElementById('btn-pause'),
      startModal: document.getElementById('start-screen'),
      btnStart: document.getElementById('btn-start-game'),
      diffCadet: document.getElementById('diff-cadet'),
      diffHacker: document.getElementById('diff-hacker'),
      diffOverlord: document.getElementById('diff-overlord'),
      pauseModal: document.getElementById('pause-screen'),
      btnResume: document.getElementById('btn-resume'),
      btnRestartPause: document.getElementById('btn-restart-pause'),
      gameOverModal: document.getElementById('game-over-screen'),
      goScore: document.getElementById('go-score'),
      goWpm: document.getElementById('go-wpm'),
      goAcc: document.getElementById('go-acc'),
      goDrones: document.getElementById('go-drones'),
      goCombo: document.getElementById('go-combo'),
      goHighscoreBanner: document.getElementById('go-highscore-banner'),
      btnRestartGo: document.getElementById('btn-restart-go'),
      btnDiffGo: document.getElementById('btn-diff-go'),
      startHighscore: document.getElementById('start-highscore'),
      mobileInput: document.getElementById('mobile-input'),
      btnMobileKb: document.getElementById('btn-mobile-kb')
    };

    if (this.dom.startHighscore) {
      this.dom.startHighscore.textContent = this.highScore.toLocaleString();
    }
  }

  bindEvents() {
    // Global gesture audio unlock
    const unlockAudio = () => {
      this.audio.ensureContext();
    };
    document.addEventListener('pointerdown', unlockAudio, { passive: true });
    document.addEventListener('keydown', unlockAudio, { passive: true });

    // Start Game Button
    if (this.dom.btnStart) {
      this.dom.btnStart.addEventListener('click', () => this.startGame());
    }

    // Difficulty buttons
    const diffButtons = [
      { el: this.dom.diffCadet, val: 'cadet' },
      { el: this.dom.diffHacker, val: 'hacker' },
      { el: this.dom.diffOverlord, val: 'overlord' }
    ];

    diffButtons.forEach(({ el, val }) => {
      if (!el) return;
      el.addEventListener('click', () => {
        diffButtons.forEach(b => b.el && b.el.classList.remove('active'));
        el.classList.add('active');
        this.difficulty = val;
      });
    });

    // Mute button
    if (this.dom.btnMute) {
      this.dom.btnMute.addEventListener('click', () => {
        const unmuted = this.audio.toggleMute();
        this.dom.btnMute.textContent = unmuted ? '🔊' : '🔇';
      });
    }

    // Pause button
    if (this.dom.btnPause) {
      this.dom.btnPause.addEventListener('click', () => this.togglePause());
    }
    if (this.dom.btnResume) {
      this.dom.btnResume.addEventListener('click', () => this.togglePause());
    }
    if (this.dom.btnRestartPause) {
      this.dom.btnRestartPause.addEventListener('click', () => {
        this.togglePause();
        this.startGame();
      });
    }

    // Game Over buttons
    if (this.dom.btnRestartGo) {
      this.dom.btnRestartGo.addEventListener('click', () => this.startGame());
    }
    if (this.dom.btnDiffGo) {
      this.dom.btnDiffGo.addEventListener('click', () => {
        this.dom.gameOverModal.classList.add('hidden');
        this.dom.startModal.classList.remove('hidden');
        this.state = 'START';
      });
    }

    // Physical Keyboard Typing Listener
    window.addEventListener('keydown', (e) => {
      // Space to start
      if (e.code === 'Space') {
        if (this.state === 'START' || this.state === 'GAMEOVER') {
          e.preventDefault();
          this.startGame();
          return;
        }
      }

      // Escape: unlocks active target first, or pauses if no target
      if (e.code === 'Escape') {
        if (this.state === 'PLAYING') {
          e.preventDefault();
          if (this.activeTarget) {
            this.unlockTarget();
          } else {
            this.togglePause();
          }
          return;
        } else if (this.state === 'PAUSED') {
          e.preventDefault();
          this.togglePause();
          return;
        }
      }

      // Backspace: Tactical target retreat / correction
      if (e.code === 'Backspace' && this.state === 'PLAYING') {
        if (this.activeTarget) {
          e.preventDefault();
          this.activeTarget.typedIndex = Math.max(0, this.activeTarget.typedIndex - 1);
          if (this.activeTarget.typedIndex === 0) {
            this.unlockTarget();
          } else {
            this.renderWordTagContent(
              this.activeTarget.domEl,
              this.activeTarget.word,
              this.activeTarget.typedIndex
            );
          }
          return;
        }
      }

      if (this.state !== 'PLAYING') return;

      // Ignore modifier and non-character keys
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return;

      const char = e.key.toLowerCase();
      if (/[a-z0-9]/.test(char)) {
        this.handleCharInput(char);
      }
    });

    // Mobile Virtual Keyboard Handling
    if (this.dom.btnMobileKb && this.dom.mobileInput) {
      this.dom.btnMobileKb.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dom.mobileInput.focus();
      });

      this.dom.mobileInput.addEventListener('input', () => {
        const val = this.dom.mobileInput.value;
        if (val && this.state === 'PLAYING') {
          for (const ch of val) {
            const low = ch.toLowerCase();
            if (/[a-z0-9]/.test(low)) {
              this.handleCharInput(low);
            }
          }
        }
        this.dom.mobileInput.value = '';
      });
    }
  }

  startGame() {
    this.audio.ensureContext();

    // Reset Game Stats
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.shields = 100;
    this.wordsDestroyed = 0;
    this.totalKeystrokes = 0;
    this.correctKeystrokes = 0;
    this.startTime = Date.now();
    this.peakWPM = 0;
    this.activeTarget = null;
    this.spawnTimer = 0;

    // Clear existing enemies
    this.clearEnemies();

    // UI state
    this.dom.startModal.classList.add('hidden');
    this.dom.pauseModal.classList.add('hidden');
    this.dom.gameOverModal.classList.add('hidden');

    this.state = 'PLAYING';
    this.updateHUD();

    // Focus mobile input if touch device
    if (this.dom.mobileInput && 'ontouchstart' in window) {
      this.dom.mobileInput.focus();
    }

    // Immediate initial spawn
    this.spawnEnemy();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.dom.pauseModal.classList.remove('hidden');
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.dom.pauseModal.classList.add('hidden');
      this.lastTime = performance.now();
    }
  }

  getDifficultyConfig() {
    switch (this.difficulty) {
      case 'overlord':
        return {
          baseSpeed: 7.0,
          speedVar: 2.0,
          spawnInterval: 1.8,
          maxEnemies: 7
        };
      case 'hacker':
        return {
          baseSpeed: 5.0,
          speedVar: 1.6,
          spawnInterval: 2.4,
          maxEnemies: 5
        };
      case 'cadet':
      default:
        return {
          baseSpeed: 3.5,
          speedVar: 1.2,
          spawnInterval: 3.2,
          maxEnemies: 4
        };
    }
  }

  pickSpawnLane() {
    const aspect = (window.innerWidth || 800) / (window.innerHeight || 600);
    const maxSpread = Math.min(13.0, Math.max(6.0, 12.0 * aspect));
    const laneFractions = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75];

    // Find lane with lowest enemy count to prevent tag overlaps
    const laneStats = laneFractions.map(f => {
      const laneX = f * (maxSpread / 2);
      const count = this.enemies.filter(e => Math.abs(e.mesh.position.x - laneX) < 1.9).length;
      return { laneX, count };
    });

    laneStats.sort((a, b) => a.count - b.count);
    const candidate = laneStats[Math.floor(Math.random() * Math.min(2, laneStats.length))];
    return candidate.laneX + (Math.random() - 0.5) * 0.6;
  }

  spawnEnemy() {
    const config = this.getDifficultyConfig();
    if (this.enemies.length >= config.maxEnemies) return;

    const bank = (window.WORD_BANKS && window.WORD_BANKS[this.difficulty]) || [
      "code", "hack", "data", "byte", "node", "core", "neon", "grid"
    ];

    // Pick a word whose first letter is not already on screen if possible
    const activeFirstLetters = new Set(this.enemies.map(e => e.word[e.typedIndex]));
    let candidate = null;

    for (let attempts = 0; attempts < 15; attempts++) {
      const pick = bank[Math.floor(Math.random() * bank.length)].toLowerCase();
      if (!this.enemies.some(e => e.word === pick)) {
        if (!activeFirstLetters.has(pick[0]) || attempts > 10) {
          candidate = pick;
          break;
        }
      }
    }

    if (!candidate) {
      candidate = bank[Math.floor(Math.random() * bank.length)].toLowerCase();
    }

    // Create 3D Mesh
    const mesh = this.scene.createDroneMesh();

    // Position drone in balanced lane
    const x = this.pickSpawnLane();
    const y = 0.6 + Math.random() * 3.2;
    const z = -68.0 - Math.random() * 12.0;
    mesh.position.set(x, y, z);

    // Create Floating DOM Label
    const tagEl = document.createElement('div');
    tagEl.className = 'word-tag';
    this.renderWordTagContent(tagEl, candidate, 0);
    this.wordContainer.appendChild(tagEl);

    // Slight speed bonus scaling with score
    const scoreBonus = Math.min(2.2, this.score * 0.0008);

    const enemy = {
      id: `enemy_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      word: candidate,
      typedIndex: 0,
      mesh,
      domEl: tagEl,
      speed: config.baseSpeed + Math.random() * config.speedVar + scoreBonus,
      seed: Math.random() * 100
    };

    this.enemies.push(enemy);
  }

  renderWordTagContent(el, word, typedIndex) {
    const typed = word.slice(0, typedIndex);
    const nextChar = typedIndex < word.length ? word[typedIndex] : '';
    const pending = word.slice(typedIndex + 1);

    let html = '';
    if (typed) html += `<span class="char-typed">${typed}</span>`;
    if (nextChar) html += `<span class="char-next">${nextChar}</span>`;
    if (pending) html += `<span class="char-pending">${pending}</span>`;

    el.innerHTML = html;
  }

  handleCharInput(char) {
    if (this.state !== 'PLAYING') return;

    this.totalKeystrokes++;

    // 1. If no drone is currently targeted, find matching drone
    if (!this.activeTarget) {
      const matches = this.enemies.filter(e => e.typedIndex === 0 && e.word[0] === char);

      if (matches.length > 0) {
        // Target the one closest to the player (highest Z coordinate)
        matches.sort((a, b) => b.mesh.position.z - a.mesh.position.z);
        const target = matches[0];

        this.lockTarget(target);
        this.advanceTargetLetter();
      } else {
        // Miss / Typo
        this.handleTypo();
      }
      return;
    }

    // 2. An active drone is locked
    const expected = this.activeTarget.word[this.activeTarget.typedIndex];
    if (char === expected) {
      this.advanceTargetLetter();
    } else {
      // Typo on locked target
      this.handleTypo();
    }
  }

  lockTarget(enemy) {
    this.activeTarget = enemy;
    enemy.domEl.classList.add('is-target');
    this.scene.currentTargetPos = enemy.mesh.position;
  }

  unlockTarget() {
    if (this.activeTarget) {
      if (this.activeTarget.domEl) {
        this.activeTarget.domEl.classList.remove('is-target');
        this.renderWordTagContent(this.activeTarget.domEl, this.activeTarget.word, 0);
      }
      this.activeTarget.typedIndex = 0;
      this.activeTarget = null;
      this.scene.currentTargetPos = null;
    }
  }

  advanceTargetLetter() {
    this.correctKeystrokes++;
    this.activeTarget.typedIndex++;
    this.score += 5 * this.combo;

    this.audio.playKeyStroke();
    this.renderWordTagContent(
      this.activeTarget.domEl,
      this.activeTarget.word,
      this.activeTarget.typedIndex
    );

    // Check if word is completely typed
    if (this.activeTarget.typedIndex >= this.activeTarget.word.length) {
      this.destroyTarget(this.activeTarget);
    }

    this.updateHUD();
  }

  destroyTarget(enemy) {
    // Scoring & Combo Calculation
    const wordScore = enemy.word.length * 15 * this.combo;
    this.score += wordScore;
    this.wordsDestroyed++;

    // Combo multiplier up to 10x
    this.combo = Math.min(10, this.combo + 1);
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    // Combo Audio Fanfare
    if (this.combo === 3 || this.combo === 5 || this.combo === 8 || this.combo === 10) {
      this.audio.playCombo(Math.floor(this.combo / 2));
      if (this.dom.comboBadge) {
        this.dom.comboBadge.classList.add('pop');
        setTimeout(() => this.dom.comboBadge.classList.remove('pop'), 200);
      }
    }

    // 1. Remove DOM label immediately
    if (enemy.domEl && enemy.domEl.parentNode) {
      enemy.domEl.parentNode.removeChild(enemy.domEl);
    }

    // 2. Remove from active enemies array so it cannot breach shield
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
    }
    this.activeTarget = null;
    this.scene.currentTargetPos = null;

    // 3. Fire plasma cannon; when laser reaches the drone mesh, explode it!
    this.audio.playLaser();
    this.scene.fireLaser(enemy.mesh, (impactPos) => {
      this.audio.playExplosion();
      this.scene.createExplosion(impactPos);
      this.scene.removeDroneMesh(enemy.mesh);
    });

    // 4. Update High Score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('cybertyper_highscore', this.highScore.toString());
    }

    this.updateHUD();
  }

  handleTypo() {
    this.audio.playError();
    this.combo = 1;

    if (this.activeTarget && this.activeTarget.domEl) {
      this.activeTarget.domEl.style.borderColor = '#ff0055';
      setTimeout(() => {
        if (this.activeTarget && this.activeTarget.domEl) {
          this.activeTarget.domEl.style.borderColor = '';
        }
      }, 150);
    }

    this.updateHUD();
  }

  onShieldBreach(enemy) {
    this.shields = Math.max(0, this.shields - 25);
    this.audio.playShieldHit();
    this.scene.triggerShieldBreachShake();

    // Red screen flash effect
    document.body.classList.add('breach-flash');
    setTimeout(() => document.body.classList.remove('breach-flash'), 280);

    if (this.activeTarget === enemy) {
      this.activeTarget = null;
      this.scene.currentTargetPos = null;
    }

    this.removeEnemy(enemy);
    this.combo = 1;
    this.updateHUD();

    if (this.shields <= 0) {
      this.gameOver();
    }
  }

  removeEnemy(enemy) {
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
    }

    if (enemy.domEl && enemy.domEl.parentNode) {
      enemy.domEl.parentNode.removeChild(enemy.domEl);
    }

    this.scene.removeDroneMesh(enemy.mesh);
  }

  clearEnemies() {
    for (const enemy of this.enemies) {
      if (enemy.domEl && enemy.domEl.parentNode) {
        enemy.domEl.parentNode.removeChild(enemy.domEl);
      }
      this.scene.removeDroneMesh(enemy.mesh);
    }
    this.enemies = [];
    this.activeTarget = null;
    this.scene.currentTargetPos = null;
  }

  gameOver() {
    this.state = 'GAMEOVER';
    this.audio.playGameOver();

    // Populate Game Over Screen
    if (this.dom.goScore) this.dom.goScore.textContent = this.score.toLocaleString();
    if (this.dom.goWpm) this.dom.goWpm.textContent = this.peakWPM.toString();
    
    const accuracy = this.totalKeystrokes > 0
      ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100)
      : 100;
    if (this.dom.goAcc) this.dom.goAcc.textContent = `${accuracy}%`;
    if (this.dom.goDrones) this.dom.goDrones.textContent = this.wordsDestroyed.toString();
    if (this.dom.goCombo) this.dom.goCombo.textContent = `${this.maxCombo}x`;

    if (this.dom.goHighscoreBanner) {
      if (this.score >= this.highScore && this.score > 0) {
        this.dom.goHighscoreBanner.textContent = `★ NEW HIGH SCORE: ${this.highScore.toLocaleString()} ★`;
        this.dom.goHighscoreBanner.style.display = 'inline-block';
      } else {
        this.dom.goHighscoreBanner.textContent = `HIGH SCORE: ${this.highScore.toLocaleString()}`;
        this.dom.goHighscoreBanner.style.display = 'inline-block';
      }
    }

    this.dom.gameOverModal.classList.remove('hidden');
  }

  updateHUD() {
    // Score
    if (this.dom.scoreVal) {
      this.dom.scoreVal.textContent = this.score.toLocaleString();
    }

    // Combo
    if (this.dom.comboVal) {
      this.dom.comboVal.textContent = `${this.combo}x`;
    }

    // Shield Bar
    if (this.dom.shieldBar) {
      this.dom.shieldBar.style.width = `${this.shields}%`;
      this.dom.shieldBar.className = 'shield-bar-fill';
      if (this.shields <= 25) {
        this.dom.shieldBar.classList.add('critical');
      } else if (this.shields <= 50) {
        this.dom.shieldBar.classList.add('warning');
      }
    }
    if (this.dom.shieldVal) {
      this.dom.shieldVal.textContent = `${this.shields}%`;
    }

    // WPM & Accuracy
    if (this.startTime && this.state === 'PLAYING') {
      const elapsedMin = (Date.now() - this.startTime) / 60000;
      const wpm = Math.round((this.correctKeystrokes / 5) / Math.max(0.08, elapsedMin));
      if (wpm > this.peakWPM) this.peakWPM = wpm;

      if (this.dom.wpmVal) this.dom.wpmVal.textContent = wpm.toString();

      const acc = this.totalKeystrokes > 0
        ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100)
        : 100;
      if (this.dom.accVal) this.dom.accVal.textContent = `${acc}%`;
    }
  }

  loop(timestamp) {
    requestAnimationFrame(this.loop);

    const delta = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    if (this.state === 'PLAYING') {
      // 1. Spawning Logic
      const config = this.getDifficultyConfig();
      this.spawnTimer += delta;
      if (this.spawnTimer >= config.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnEnemy();
      }

      // 2. Update Drone Positions & Floating Labels
      const breachThreshold = 3.8;

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];

        // Move along Z axis toward player
        enemy.mesh.position.z += enemy.speed * delta;

        // Animate drone gyroscopic rings
        if (enemy.mesh.userData.ring1) {
          enemy.mesh.userData.ring1.rotation.y += 2.5 * delta;
        }
        if (enemy.mesh.userData.ring2) {
          enemy.mesh.userData.ring2.rotation.x += 1.8 * delta;
        }
        if (enemy.mesh.userData.core) {
          const pulse = 1.0 + Math.sin(timestamp * 0.007 + enemy.seed) * 0.12;
          enemy.mesh.userData.core.scale.set(pulse, pulse, pulse);
        }

        // Check Shield Breach
        if (enemy.mesh.position.z >= breachThreshold) {
          this.onShieldBreach(enemy);
          continue;
        }

        // 3D to 2D Screen Projection for floating badge
        const proj = this.scene.projectToScreen(enemy.mesh.position);
        if (proj.isVisible) {
          enemy.domEl.style.display = 'block';
          const px = Math.round(proj.x);
          const py = Math.round(proj.y - 48 * proj.scale);
          enemy.domEl.style.transform = `translate3d(${px}px, ${py}px, 0) scale(${proj.scale.toFixed(3)})`;

          // Danger warning if drone is close (Z > -5)
          if (enemy.mesh.position.z > -5.0) {
            enemy.domEl.classList.add('danger');
          } else {
            enemy.domEl.classList.remove('danger');
          }
        } else {
          enemy.domEl.style.display = 'none';
        }
      }

      // Update real-time WPM & Telemetry
      this.updateHUD();
    }

    // Always render 3D Scene in unified lockstep
    this.scene.renderFrame(delta, timestamp * 0.001);
  }
}

// Initialize on window load
window.addEventListener('DOMContentLoaded', () => {
  window.game = new CyberTyperGame();
});
