// ======================================
// Y2K TETRIS — OJT Tracker Mini Game
// ======================================
(function () {
    'use strict';

    const BS = 24, COLS = 10, ROWS = 20;

    const CLR = {
        I:'#00f5ff', O:'#b0ff00', T:'#ff2d78',
        S:'#00ff64', Z:'#ff8c00', J:'#9b4dff', L:'#ffdd00',
        BG:'#080810', GRID:'rgba(0,245,255,0.04)'
    };

    const SHP = {
        I:[[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],[[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
           [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],[[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]],
        O:[[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]],[[1,1],[1,1]]],
        T:[[[0,1,0],[1,1,1],[0,0,0]],[[0,1,0],[0,1,1],[0,1,0]],[[0,0,0],[1,1,1],[0,1,0]],[[0,1,0],[1,1,0],[0,1,0]]],
        S:[[[0,1,1],[1,1,0],[0,0,0]],[[0,1,0],[0,1,1],[0,0,1]],[[0,0,0],[0,1,1],[1,1,0]],[[1,0,0],[1,1,0],[0,1,0]]],
        Z:[[[1,1,0],[0,1,1],[0,0,0]],[[0,0,1],[0,1,1],[0,1,0]],[[0,0,0],[1,1,0],[0,1,1]],[[0,1,0],[1,1,0],[1,0,0]]],
        J:[[[1,0,0],[1,1,1],[0,0,0]],[[0,1,1],[0,1,0],[0,1,0]],[[0,0,0],[1,1,1],[0,0,1]],[[0,1,0],[0,1,0],[1,1,0]]],
        L:[[[0,0,1],[1,1,1],[0,0,0]],[[0,1,0],[0,1,0],[0,1,1]],[[0,0,0],[1,1,1],[1,0,0]],[[1,1,0],[0,1,0],[0,1,0]]]
    };

    const TYPES = Object.keys(SHP);
    const KICKS = [[0,0],[-1,0],[1,0],[0,-1],[-1,-1],[1,-1],[0,1],[2,0],[-2,0],[-1,1],[1,1]];

    class Tetris {
        constructor() {
            this.canvas  = document.getElementById('tBoard');
            this.ctx     = this.canvas.getContext('2d');
            this.hCanvas = document.getElementById('tHold');
            this.hCtx    = this.hCanvas.getContext('2d');
            this.nCanvas = document.getElementById('tNext');
            this.nCtx    = this.nCanvas.getContext('2d');
            this.elScore = document.getElementById('tScore');
            this.elHi    = document.getElementById('tHi');
            this.elLevel = document.getElementById('tLevel');
            this.elLines = document.getElementById('tLines');

            // Overlay elements
            this.elOverlay = document.getElementById('tOverlay');
            this.elOverlayScore = document.getElementById('tOverlayScoreInfo');
            this.btnTryAgain = document.getElementById('tTryAgainBtn');
            this.elOverlayTitle = document.getElementById('tOverlayTitle');

            this.hi = parseInt(localStorage.getItem('ojt_tetris_hi') || '0');
            this.elHi.textContent = this.hi;

            this.state = 'idle'; // idle | playing | paused | over
            this.raf = null;
            this.active = false; // keyboard capture

            // DAS
            this.held = {};
            this.dasT = {};
            this.dasI = {};

            this.reset();
            this.drawScreen('TETRIS', ['CLICK TO START']);

            this.bindEvents();
        }

        // ---- State ----
        reset() {
            if (this.elOverlay) this.elOverlay.style.display = 'none';
            this.board = Array.from({length: ROWS}, () => Array(COLS).fill(null));
            this.score = 0; this.level = 1; this.lines = 0;
            this.hold = null; this.holdUsed = false;
            this.bag = [];
            this.next = [this.pull(), this.pull(), this.pull()];
            this.cur = this.spawn();
            this.dropAcc = 0;
            this.updateHUD();
        }

        dropMs() { return Math.max(50, 1000 - (this.level - 1) * 90); }

        // ---- Bag ----
        pull() {
            if (!this.bag.length) {
                const t = [...TYPES];
                for (let i = t.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [t[i], t[j]] = [t[j], t[i]];
                }
                this.bag.push(...t);
            }
            return this.bag.shift();
        }

        spawn() {
            const type = this.next.shift();
            this.next.push(this.pull());
            const s = SHP[type][0];
            return { type, rot: 0, x: Math.floor(COLS/2) - Math.floor(s[0].length/2), y: 0 };
        }

        shape(p) { return SHP[p.type][p.rot]; }

        // ---- Movement ----
        valid(p, dx=0, dy=0, rot=null) {
            const s = SHP[p.type][rot !== null ? rot : p.rot];
            for (let r = 0; r < s.length; r++)
                for (let c = 0; c < s[r].length; c++) {
                    if (!s[r][c]) continue;
                    const nx = p.x + c + dx, ny = p.y + r + dy;
                    if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
                    if (ny >= 0 && this.board[ny][nx]) return false;
                }
            return true;
        }

        moveL() { if (this.valid(this.cur,-1,0)) this.cur.x--; }
        moveR() { if (this.valid(this.cur, 1,0)) this.cur.x++; }

        softDrop() {
            if (this.valid(this.cur,0,1)) { this.cur.y++; this.addScore(1); return true; }
            this.lock(); return false;
        }

        hardDrop() {
            let n = 0;
            while (this.valid(this.cur,0,1)) { this.cur.y++; n++; }
            this.addScore(n * 2);
            this.lock();
        }

        rotate(dir=1) {
            const nr = (this.cur.rot + dir + 4) % 4;
            for (const [dx, dy] of KICKS)
                if (this.valid(this.cur, dx, dy, nr)) {
                    this.cur.x += dx; this.cur.y += dy; this.cur.rot = nr; return;
                }
        }

        doHold() {
            if (this.holdUsed) return;
            this.holdUsed = true;
            if (!this.hold) {
                this.hold = this.cur.type;
                this.cur = this.spawn();
            } else {
                const tmp = this.hold;
                this.hold = this.cur.type;
                const s = SHP[tmp][0];
                this.cur = { type: tmp, rot: 0, x: Math.floor(COLS/2) - Math.floor(s[0].length/2), y: 0 };
            }
        }

        ghostY() {
            let gy = this.cur.y;
            while (this.valid(this.cur, 0, gy - this.cur.y + 1)) gy++;
            return gy;
        }

        lock() {
            const s = this.shape(this.cur);
            for (let r = 0; r < s.length; r++)
                for (let c = 0; c < s[r].length; c++) {
                    if (!s[r][c]) continue;
                    const ny = this.cur.y + r, nx = this.cur.x + c;
                    if (ny < 0) { this.gameOver(); return; }
                    this.board[ny][nx] = this.cur.type;
                }
            this.clearLines();
            this.holdUsed = false;
            this.cur = this.spawn();
            if (!this.valid(this.cur)) this.gameOver();
        }

        clearLines() {
            let n = 0;
            for (let r = ROWS - 1; r >= 0; r--) {
                if (this.board[r].every(c => c)) {
                    this.board.splice(r, 1);
                    this.board.unshift(Array(COLS).fill(null));
                    n++; r++;
                }
            }
            if (!n) return;
            const pts = [0,100,300,500,800][n] * this.level;
            this.addScore(pts);
            this.lines += n;
            this.level = Math.floor(this.lines / 10) + 1;
            this.updateHUD();
        }

        addScore(n) {
            this.score += n;
            if (this.score > this.hi) {
                this.hi = this.score;
                localStorage.setItem('ojt_tetris_hi', this.hi);
                this.elHi.textContent = this.hi;
            }
            this.elScore.textContent = this.score;
        }

        updateHUD() {
            this.elScore.textContent = this.score;
            this.elLevel.textContent = this.level;
            this.elLines.textContent = this.lines;
        }

        gameOver() {
            this.state = 'over';
            if (this.raf) cancelAnimationFrame(this.raf);
            this.clearDAS();
            this.drawBoard();
            
            // Show overlay
            if (this.elOverlay) {
                this.elOverlay.style.display = 'flex';
                this.elOverlayTitle.textContent = 'GAME OVER';
                this.elOverlayScore.textContent = 'SCORE: ' + this.score;
            }
        }

        // ---- Drawing ----
        block(ctx, x, y, color, sz=BS) {
            ctx.fillStyle = color;
            ctx.fillRect(x*sz+1, y*sz+1, sz-2, sz-2);
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.fillRect(x*sz+1, y*sz+1, sz-2, 2);
            ctx.fillRect(x*sz+1, y*sz+1, 2, sz-2);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(x*sz+1, y*sz+sz-3, sz-2, 2);
        }

        drawBoard() {
            const ctx = this.ctx;
            ctx.fillStyle = CLR.BG;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.strokeStyle = CLR.GRID; ctx.lineWidth = 0.5;
            for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) ctx.strokeRect(c*BS,r*BS,BS,BS);
            for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++)
                if (this.board[r][c]) this.block(ctx, c, r, CLR[this.board[r][c]]);

            if (this.state === 'playing' || this.state === 'paused') {
                // Ghost
                const gy = this.ghostY();
                const s = this.shape(this.cur);
                for (let r=0;r<s.length;r++) for (let c=0;c<s[r].length;c++) {
                    if (!s[r][c]) continue;
                    const gx=this.cur.x+c, gr=gy+r;
                    if (gr>=0&&gr<ROWS) {
                        ctx.fillStyle='rgba(255,255,255,0.08)';
                        ctx.fillRect(gx*BS+1,gr*BS+1,BS-2,BS-2);
                        ctx.strokeStyle=CLR[this.cur.type]; ctx.globalAlpha=0.25;
                        ctx.strokeRect(gx*BS+1,gr*BS+1,BS-2,BS-2);
                        ctx.globalAlpha=1;
                    }
                }
                // Current
                for (let r=0;r<s.length;r++) for (let c=0;c<s[r].length;c++) {
                    if (!s[r][c]) continue;
                    const bx=this.cur.x+c, by=this.cur.y+r;
                    if (by>=0) this.block(ctx, bx, by, CLR[this.cur.type]);
                }
            }
        }

        drawMini(ctx, type, cw, ch) {
            ctx.fillStyle = CLR.BG;
            ctx.fillRect(0,0,cw,ch);
            if (!type) return;
            const s=SHP[type][0], rows=s.length, cols=s[0].length, sz=18;
            const ox=Math.floor((cw/sz-cols)/2), oy=Math.floor((ch/sz-rows)/2);
            for (let r=0;r<rows;r++) for (let c=0;c<cols;c++)
                if (s[r][c]) this.block(ctx, ox+c, oy+r, CLR[type], sz);
        }

        drawScreen(title, lines) {
            const ctx = this.ctx, cw=this.canvas.width, ch=this.canvas.height;
            ctx.fillStyle='rgba(8,8,16,0.86)';
            ctx.fillRect(0,0,cw,ch);
            ctx.textAlign='center';
            ctx.fillStyle='#ff2d78'; ctx.shadowColor='#ff2d78'; ctx.shadowBlur=20;
            ctx.font='bold 14px "Press Start 2P",monospace';
            ctx.fillText(title, cw/2, ch/2 - 40);
            ctx.shadowBlur=0; ctx.font='8px "Press Start 2P",monospace';
            lines.forEach((l,i)=>{
                ctx.fillStyle = i===0 ? '#b0ff00' : '#00f5ff';
                ctx.fillText(l, cw/2, ch/2 + 5 + i*20);
            });
            ctx.textAlign='left';
        }

        render() {
            this.drawBoard();
            this.drawMini(this.hCtx, this.hold, this.hCanvas.width, this.hCanvas.height);
            this.drawMini(this.nCtx, this.next[0], this.nCanvas.width, this.nCanvas.height);
            if (this.state==='paused') this.drawScreen('PAUSED',['P TO RESUME']);
        }

        // ---- Game Loop ----
        start() {
            this.reset();
            this.state = 'playing';
            this.lastT = performance.now();
            this.loop(this.lastT);
        }

        togglePause() {
            if (this.state==='playing') {
                this.state='paused';
                cancelAnimationFrame(this.raf);
                this.clearDAS();
                this.render();
            } else if (this.state==='paused') {
                this.state='playing';
                this.lastT=performance.now();
                this.loop(this.lastT);
            }
        }

        loop(t) {
            if (this.state!=='playing') return;
            const dt = t - this.lastT; this.lastT = t;
            this.dropAcc += dt;
            if (this.dropAcc >= this.dropMs()) { this.dropAcc=0; this.softDropAuto(); }
            this.render();
            this.raf = requestAnimationFrame(ts => this.loop(ts));
        }

        softDropAuto() {
            if (!this.valid(this.cur,0,1)) { this.lock(); return; }
            this.cur.y++;
        }

        // ---- Input ----
        clearDAS() {
            Object.values(this.dasT).forEach(clearTimeout);
            Object.values(this.dasI).forEach(clearInterval);
            this.dasT={}; this.dasI={}; this.held={};
        }

        doKey(key) {
            if (this.state==='idle'||this.state==='over') {
                if (key==='Enter'||key===' ') this.start();
                return;
            }
            if (key==='Escape'||key==='p'||key==='P') { this.togglePause(); return; }
            if (this.state!=='playing') return;
            switch(key) {
                case 'ArrowLeft':  case 'a': case 'A': this.moveL(); break;
                case 'ArrowRight': case 'd': case 'D': this.moveR(); break;
                case 'ArrowDown':  case 's': case 'S': this.softDrop(); break;
                case 'ArrowUp':    case 'w': case 'W': this.rotate(1); break;
                case 'z': case 'Z': this.rotate(-1); break;
                case ' ':          this.hardDrop(); break;
                case 'c': case 'C': case 'Shift': this.doHold(); break;
            }
            this.render();
        }

        bindEvents() {
            const cont = document.getElementById('tetrisContainer');

            const activate = () => { this.active=true; cont.focus(); };
            cont.addEventListener('click', () => {
                activate();
                if (this.state==='idle'||this.state==='over') this.start();
            });
            cont.addEventListener('focus', () => { this.active=true; });
            cont.addEventListener('blur', () => { this.active=false; this.clearDAS(); });

            if (this.btnTryAgain) {
                this.btnTryAgain.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.start();
                });
            }

            const DAS_DELAY=170, ARR=50;
            const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'a', 'A', 'd', 'D', 's', 'S', 'w', 'W', ' ', 'z', 'Z', 'c', 'C', 'Shift', 'Escape', 'p', 'P'];

            document.addEventListener('keydown', e => {
                if (!this.active) return;
                const k = e.key;

                // prevent page scroll for game keys
                if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k)) e.preventDefault();

                if (this.held[k]) return;
                this.held[k] = true;
                this.doKey(k);

                if (['ArrowLeft','ArrowRight','ArrowDown','a','A','d','D','s','S'].includes(k)) {
                    this.dasT[k] = setTimeout(()=>{
                        this.dasI[k] = setInterval(()=>{
                            if (this.state==='playing') { this.doKey(k); this.render(); }
                        }, ARR);
                    }, DAS_DELAY);
                }
            });

            document.addEventListener('keyup', e => {
                const k = e.key;
                this.held[k] = false;
                clearTimeout(this.dasT[k]);
                clearInterval(this.dasI[k]);
                delete this.dasT[k]; delete this.dasI[k];
            });
        }
    }

    function init() {
        if (!document.getElementById('tBoard')) return;
        new Tetris();
    }

    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
