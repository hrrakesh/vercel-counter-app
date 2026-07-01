/**
 * Quantum Counter Pro - Core Logic
 * Procedural Audio Synthesizer, Canvas Particle Engine, Session Metrics, 
 * State Serialization, and Multicounter Collections.
 */

// --- APPLICATION STATE ---
const state = {
    counters: [
        { id: 'default', name: 'Primary Counter', value: 0, lastUpdated: Date.now() }
    ],
    activeCounterId: 'default',
    stepSize: 1,
    minBounds: { enabled: false, value: -50 },
    maxBounds: { enabled: false, value: 100 },
    soundEnabled: true,
    glassMode: true,
    
    // Stats tracking (session-specific)
    stats: {
        totalClicks: 0,
        peakMax: 0,
        peakMin: 0,
        clickTimestamps: []
    },
    
    // Undo/Redo stack for the active session/counter
    history: [0],
    historyIndex: 0
};

// Auto-clicker state
let autoclickerInterval = null;
let sessionStartTime = Date.now();
let activeTimeInterval = null;
let cpsInterval = null;

// --- DOM ELEMENTS ---
const counterEl = document.getElementById('counter');
const counterCardEl = document.getElementById('counter-card');
const decLabelEl = document.getElementById('dec-label');
const incLabelEl = document.getElementById('inc-label');
const activeCounterNameEl = document.getElementById('active-counter-name');
const boundsIndicatorEl = document.getElementById('bounds-indicator');

// Inputs & Configs
const stepSlider = document.getElementById('step-slider');
const stepInput = document.getElementById('step-input');
const minBoundsToggle = document.getElementById('min-bounds-toggle');
const minBoundsVal = document.getElementById('min-bounds-val');
const maxBoundsToggle = document.getElementById('max-bounds-toggle');
const maxBoundsVal = document.getElementById('max-bounds-val');

// Auto-clicker
const autoclickerDirection = document.getElementById('autoclicker-direction');
const autoclickerSpeed = document.getElementById('autoclicker-speed');
const speedLabel = document.getElementById('speed-label');
const autoclickerToggle = document.getElementById('autoclicker-toggle');

// Collections
const newCounterForm = document.getElementById('new-counter-form');
const newCounterNameInput = document.getElementById('new-counter-name');
const counterListEl = document.getElementById('counter-list');

// Stats
const statTotalClicks = document.getElementById('stat-total-clicks');
const statPeakMax = document.getElementById('stat-peak-max');
const statPeakMin = document.getElementById('stat-peak-min');
const statClickSpeed = document.getElementById('stat-click-speed');
const sessionTimerEl = document.getElementById('session-timer');

// Logs & Undo/Redo
const logContainer = document.getElementById('log-container');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const clearLogBtn = document.getElementById('clear-log-btn');
const exportDataBtn = document.getElementById('export-data-btn');

// Global action buttons
const soundToggleBtn = document.getElementById('sound-toggle');
const soundIconEl = document.getElementById('sound-icon');
const soundTextEl = document.getElementById('sound-text');
const themeToggleBtn = document.getElementById('theme-toggle');

// Accordion
const accordionTrigger = document.querySelector('.accordion-trigger');
const accordionSection = document.querySelector('.accordion-section');

// Canvas
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');


// --- CANVAS PARTICLE SYSTEM ---
let particles = [];
let canvasWidth = canvas.width = window.innerWidth;
let canvasHeight = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvasWidth = canvas.width = window.innerWidth;
    canvasHeight = canvas.height = window.innerHeight;
});

class Particle {
    constructor(x, y, color, vx, vy, size, alphaSpeed, gravity = 0) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.alpha = 1;
        this.alphaSpeed = alphaSpeed;
        this.gravity = gravity;
    }
    
    update() {
        this.vy += this.gravity;
        this.vx *= 0.98; // Drag
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.alphaSpeed;
    }
    
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        
        // Add particle glow
        ctx.shadowBlur = this.size * 2;
        ctx.shadowColor = this.color;
        
        ctx.fill();
        ctx.restore();
    }
}

// Spawn burst of particles on clicks
function spawnParticleBurst(x, y, type) {
    let color;
    let count = 15 + Math.floor(Math.random() * 10);
    let gravity = 0.05;
    
    if (type === 'increment') {
        color = 'rgba(16, 185, 129, '; // emerald
    } else if (type === 'decrement') {
        color = 'rgba(239, 68, 68, '; // crimson
    } else {
        color = 'rgba(99, 102, 241, '; // indigo
    }
    
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        let vx = Math.cos(angle) * speed;
        let vy = Math.sin(angle) * speed;
        
        // Add directional bias
        if (type === 'increment') {
            vy -= 1.5; // fly upwards
        } else if (type === 'decrement') {
            vy += 1.5; // fly downwards
        }
        
        const size = 2 + Math.random() * 4;
        const alphaSpeed = 0.015 + Math.random() * 0.015;
        const fullColor = color + '0.8)';
        
        particles.push(new Particle(x, y, fullColor, vx, vy, size, alphaSpeed, gravity));
    }
}

// Ambient Floating Particles
function spawnAmbientParticles() {
    if (particles.length < 50 && Math.random() < 0.1) {
        const x = Math.random() * canvasWidth;
        const y = canvasHeight + 10;
        const size = 1 + Math.random() * 2;
        const vx = (Math.random() - 0.5) * 0.5;
        const vy = -0.3 - Math.random() * 0.7;
        const alphaSpeed = 0.001 + Math.random() * 0.002;
        
        let color = 'rgba(99, 102, 241, '; // Indigo default
        const activeVal = getActiveCounter().value;
        if (activeVal > 0) color = 'rgba(16, 185, 129, ';
        else if (activeVal < 0) color = 'rgba(239, 68, 68, ';
        
        const fullColor = color + (0.2 + Math.random() * 0.3) + ')';
        
        const p = new Particle(x, y, fullColor, vx, vy, size, alphaSpeed);
        p.alpha = Math.random() * 0.7;
        particles.push(p);
    }
}

// Particle Loop
function animateParticles() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    spawnAmbientParticles();
    
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.alpha <= 0 || p.x < -10 || p.x > canvasWidth + 10 || p.y < -10 || p.y > canvasHeight + 10) {
            particles.splice(i, 1);
        } else {
            p.draw();
        }
    }
    
    requestAnimationFrame(animateParticles);
}


// --- PROCEDURAL AUDIO ENGINE (WEB AUDIO API) ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSynthesizedSound(type) {
    if (!state.soundEnabled) return;
    
    try {
        initAudio();
        if (!audioCtx) return;
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const now = audioCtx.currentTime;
        
        if (type === 'increment') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            
            // Bright ascending tone
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.exponentialRampToValueAtTime(560, now + 0.1);
            
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.1);
            
        } else if (type === 'decrement') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            
            // Soft descending tone
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(180, now + 0.1);
            
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.1);
            
        } else if (type === 'reset') {
            // Indigo Triad Harmony Chord
            const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
            notes.forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + (idx * 0.05));
                
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.5);
            });
            
        } else if (type === 'milestone') {
            // Sweet retro arpeggio
            const steps = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            steps.forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                const offset = idx * 0.05;
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + offset);
                
                gain.gain.setValueAtTime(0.08, now + offset);
                gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
                
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + offset);
                osc.stop(now + offset + 0.12);
            });
            
        } else if (type === 'alert') {
            // Detuned buzz for limits
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc1.type = 'sawtooth';
            osc2.type = 'square';
            osc1.frequency.setValueAtTime(140, now);
            osc2.frequency.setValueAtTime(142, now);
            
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.2);
            osc2.stop(now + 0.2);
        }
    } catch (e) {
        console.warn("Audio Context init blocked or failed: ", e);
    }
}


// --- CORE LOGIC & STATE PERSISTENCE ---

function getActiveCounter() {
    return state.counters.find(c => c.id === state.activeCounterId) || state.counters[0];
}

// Load from LocalStorage
function loadSavedData() {
    try {
        const raw = localStorage.getItem('quantum_counter_state');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.counters && parsed.counters.length > 0) {
                state.counters = parsed.counters;
            }
            state.activeCounterId = parsed.activeCounterId || state.counters[0].id;
            state.stepSize = parsed.stepSize || 1;
            state.minBounds = parsed.minBounds || { enabled: false, value: -50 };
            state.maxBounds = parsed.maxBounds || { enabled: false, value: 100 };
            state.soundEnabled = parsed.soundEnabled !== undefined ? parsed.soundEnabled : true;
            state.glassMode = parsed.glassMode !== undefined ? parsed.glassMode : true;
            
            // Sync UI toggle states
            syncThemeClass();
            syncSoundButtonUI();
        }
    } catch (e) {
        console.error("Failed to load local storage state: ", e);
    }
    
    // Sync configuration inputs
    stepSlider.value = Math.min(state.stepSize, 100);
    stepInput.value = state.stepSize;
    
    minBoundsToggle.checked = state.minBounds.enabled;
    minBoundsVal.value = state.minBounds.value;
    minBoundsVal.disabled = !state.minBounds.enabled;
    
    maxBoundsToggle.checked = state.maxBounds.enabled;
    maxBoundsVal.value = state.maxBounds.value;
    maxBoundsVal.disabled = !state.maxBounds.enabled;
    
    // Initialize session state stats
    const activeVal = getActiveCounter().value;
    state.stats.peakMax = activeVal;
    state.stats.peakMin = activeVal;
    state.history = [activeVal];
    state.historyIndex = 0;
    
    updateLabels();
    renderCounterList();
    renderLogs();
    updateDashboardUI();
}

// Save to LocalStorage
function saveStateToLocalStorage() {
    try {
        const toSave = {
            counters: state.counters,
            activeCounterId: state.activeCounterId,
            stepSize: state.stepSize,
            minBounds: state.minBounds,
            maxBounds: state.maxBounds,
            soundEnabled: state.soundEnabled,
            glassMode: state.glassMode
        };
        localStorage.setItem('quantum_counter_state', JSON.stringify(toSave));
    } catch (e) {
        console.error("Failed to save state to local storage: ", e);
    }
}

// Modify active counter value
function updateCounterValue(delta, type = 'manual') {
    const counterObj = getActiveCounter();
    const originalVal = counterObj.value;
    let newVal = originalVal + delta;
    
    // Check Max limit
    if (delta > 0 && state.maxBounds.enabled && newVal > state.maxBounds.value) {
        triggerLimitViolation('max');
        return false;
    }
    
    // Check Min limit
    if (delta < 0 && state.minBounds.enabled && newVal < state.minBounds.value) {
        triggerLimitViolation('min');
        return false;
    }
    
    // Commit the value
    counterObj.value = newVal;
    counterObj.lastUpdated = Date.now();
    
    // Audio feedback
    if (newVal === 0) {
        playSynthesizedSound('reset');
    } else if (Math.abs(newVal) % 10 === 0 && newVal !== 0) {
        playSynthesizedSound('milestone');
    } else {
        playSynthesizedSound(delta > 0 ? 'increment' : 'decrement');
    }
    
    // Trigger display animation
    counterCardEl.classList.remove('pop');
    void counterCardEl.offsetWidth; // force reflow
    counterCardEl.classList.add('pop');
    
    // Track stats
    state.stats.totalClicks++;
    state.stats.clickTimestamps.push(Date.now());
    if (newVal > state.stats.peakMax) state.stats.peakMax = newVal;
    if (newVal < state.stats.peakMin) state.stats.peakMin = newVal;
    
    // Logging action
    const deltaString = delta >= 0 ? `+${delta}` : `${delta}`;
    const desc = `${type === 'preset' ? 'Preset Used' : type === 'auto' ? 'Autoclicker' : 'Adjustment'}: ${deltaString}`;
    logAction(desc, newVal);
    
    // Manage undo stack (if not doing an undo/redo traverse)
    pushToHistory(newVal);
    
    // Render and Save
    updateDashboardUI();
    saveStateToLocalStorage();
    renderCounterList();
    
    return true;
}

// Reset active counter value
function resetCounter() {
    const counterObj = getActiveCounter();
    const prevVal = counterObj.value;
    if (prevVal === 0) return;
    
    counterObj.value = 0;
    counterObj.lastUpdated = Date.now();
    
    playSynthesizedSound('reset');
    
    counterCardEl.classList.remove('pop');
    void counterCardEl.offsetWidth;
    counterCardEl.classList.add('pop');
    
    state.stats.totalClicks++;
    state.stats.clickTimestamps.push(Date.now());
    if (0 > state.stats.peakMax) state.stats.peakMax = 0;
    if (0 < state.stats.peakMin) state.stats.peakMin = 0;
    
    logAction("Counter Reset", 0);
    pushToHistory(0);
    
    updateDashboardUI();
    saveStateToLocalStorage();
    renderCounterList();
}

// Undo & Redo System
function pushToHistory(val) {
    // If we've walked back in history and did a new operation, slice off forward history
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }
    
    state.history.push(val);
    if (state.history.length > 100) {
        state.history.shift();
    }
    state.historyIndex = state.history.length - 1;
    
    syncUndoRedoButtons();
}

function handleUndo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        const val = state.history[state.historyIndex];
        
        const counterObj = getActiveCounter();
        counterObj.value = val;
        counterObj.lastUpdated = Date.now();
        
        playSynthesizedSound('reset');
        logAction("Undo Action", val);
        
        updateDashboardUI();
        saveStateToLocalStorage();
        renderCounterList();
        syncUndoRedoButtons();
    }
}

function handleRedo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        const val = state.history[state.historyIndex];
        
        const counterObj = getActiveCounter();
        counterObj.value = val;
        counterObj.lastUpdated = Date.now();
        
        playSynthesizedSound('reset');
        logAction("Redo Action", val);
        
        updateDashboardUI();
        saveStateToLocalStorage();
        renderCounterList();
        syncUndoRedoButtons();
    }
}

function syncUndoRedoButtons() {
    undoBtn.disabled = state.historyIndex <= 0;
    redoBtn.disabled = state.historyIndex >= state.history.length - 1;
}

// Limits handler
function triggerLimitViolation(boundType) {
    playSynthesizedSound('alert');
    
    counterCardEl.classList.remove('shake');
    void counterCardEl.offsetWidth; // trigger reflow
    counterCardEl.classList.add('shake');
    
    const limitVal = boundType === 'max' ? state.maxBounds.value : state.minBounds.value;
    logAction(`Blocked: ${boundType.toUpperCase()} Limit Reached (${limitVal})`, getActiveCounter().value);
    
    // Automatically stop auto-clicker if it hits a boundary to prevent loop storms
    if (autoclickerInterval) {
        toggleAutoclicker(false);
        logAction("Autoclick Stopped: Limit Boundary Hit", getActiveCounter().value);
    }
}


// --- USER INTERFACE SYNCS ---

function updateDashboardUI() {
    const counterObj = getActiveCounter();
    const val = counterObj.value;
    
    // 1. Text display
    counterEl.textContent = val;
    activeCounterNameEl.textContent = counterObj.name;
    
    // 2. Dynamic accent classes on body
    document.body.classList.remove('theme-neutral', 'theme-positive', 'theme-negative');
    if (val === 0) {
        document.body.classList.add('theme-neutral');
    } else if (val > 0) {
        document.body.classList.add('theme-positive');
    } else {
        document.body.classList.add('theme-negative');
    }
    
    // 3. Bounds progress bar
    if ((state.minBounds.enabled || state.maxBounds.enabled) && state.minBounds.value < state.maxBounds.value) {
        let min = state.minBounds.enabled ? state.minBounds.value : 0;
        let max = state.maxBounds.enabled ? state.maxBounds.value : 100;
        
        // Ensure count is within scale for UI visual logic
        let pct = ((val - min) / (max - min)) * 100;
        pct = Math.max(0, Math.min(100, pct));
        boundsIndicatorEl.style.width = `${pct}%`;
    } else {
        // Without bounds, show neutral full indicator
        boundsIndicatorEl.style.width = '100%';
    }
    
    // 4. Panel Stats
    statTotalClicks.textContent = state.stats.totalClicks;
    statPeakMax.textContent = state.stats.peakMax;
    statPeakMin.textContent = state.stats.peakMin;
}

function updateLabels() {
    decLabelEl.textContent = `-${state.stepSize}`;
    incLabelEl.textContent = `+${state.stepSize}`;
}

function syncThemeClass() {
    if (state.glassMode) {
        document.body.classList.remove('opaque-mode');
        themeToggleBtn.querySelector('.btn-text').textContent = 'Neon Glow';
    } else {
        document.body.classList.add('opaque-mode');
        themeToggleBtn.querySelector('.btn-text').textContent = 'Standard Solid';
    }
}

function syncSoundButtonUI() {
    if (state.soundEnabled) {
        soundIconEl.textContent = '🔊';
        soundTextEl.textContent = 'Audio On';
        soundToggleBtn.classList.remove('muted');
    } else {
        soundIconEl.textContent = '🔇';
        soundTextEl.textContent = 'Audio Muted';
        soundToggleBtn.classList.add('muted');
    }
}


// --- MULTI-COUNTER COLLECTIONS ---

function renderCounterList() {
    counterListEl.innerHTML = '';
    
    state.counters.forEach(c => {
        const item = document.createElement('div');
        item.className = `counter-item ${c.id === state.activeCounterId ? 'active' : ''}`;
        
        const dateStr = new Date(c.lastUpdated).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        item.innerHTML = `
            <div class="counter-item-details">
                <span class="counter-item-name">${escapeHTML(c.name)}</span>
                <span class="counter-item-date">Updated ${dateStr}</span>
            </div>
            <div class="counter-item-right">
                <span class="counter-item-val">${c.value}</span>
                <button class="btn-delete-counter" title="Delete Counter" data-id="${c.id}">🗑️</button>
            </div>
        `;
        
        // Switch counter on card click (excluding delete button clicks)
        item.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete-counter')) return;
            switchCounter(c.id);
        });
        
        // Double-click to rename
        item.addEventListener('dblclick', () => {
            renameCounter(c.id);
        });
        
        // Bind delete click
        item.querySelector('.btn-delete-counter').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCounter(c.id);
        });
        
        counterListEl.appendChild(item);
    });
}

function switchCounter(id) {
    if (state.activeCounterId === id) return;
    
    // Stop auto-clicker on switch
    if (autoclickerInterval) toggleAutoclicker(false);
    
    state.activeCounterId = id;
    const counterObj = getActiveCounter();
    
    // Reset undo/redo stack for new active counter
    state.history = [counterObj.value];
    state.historyIndex = 0;
    syncUndoRedoButtons();
    
    // Set peak values tracking for session switch
    state.stats.peakMax = Math.max(state.stats.peakMax, counterObj.value);
    state.stats.peakMin = Math.min(state.stats.peakMin, counterObj.value);
    
    playSynthesizedSound('reset');
    logAction(`Switched counter: "${counterObj.name}"`, counterObj.value);
    
    updateDashboardUI();
    saveStateToLocalStorage();
    renderCounterList();
}

function deleteCounter(id) {
    if (state.counters.length <= 1) {
        alert("At least one active counter must be kept in the list.");
        return;
    }
    
    const index = state.counters.findIndex(c => c.id === id);
    if (index === -1) return;
    
    const counterName = state.counters[index].name;
    
    if (confirm(`Are you sure you want to delete counter "${counterName}"?`)) {
        state.counters.splice(index, 1);
        
        // If we deleted the active counter, point to the next available
        if (state.activeCounterId === id) {
            state.activeCounterId = state.counters[0].id;
            state.history = [getActiveCounter().value];
            state.historyIndex = 0;
            syncUndoRedoButtons();
        }
        
        playSynthesizedSound('decrement');
        logAction(`Deleted Counter: "${counterName}"`, getActiveCounter().value);
        
        updateDashboardUI();
        saveStateToLocalStorage();
        renderCounterList();
    }
}

function renameCounter(id) {
    const counterObj = state.counters.find(c => c.id === id);
    if (!counterObj) return;
    
    const newName = prompt(`Rename Counter "${counterObj.name}" to:`, counterObj.name);
    if (newName && newName.trim() !== '') {
        const oldName = counterObj.name;
        counterObj.name = newName.trim();
        counterObj.lastUpdated = Date.now();
        
        playSynthesizedSound('milestone');
        logAction(`Renamed Counter "${oldName}" to "${newName.trim()}"`, counterObj.value);
        
        updateDashboardUI();
        saveStateToLocalStorage();
        renderCounterList();
    }
}


// --- OPERATIONS LOG SYSTEM ---

function logAction(action, finalVal) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const logItem = {
        action,
        value: finalVal,
        time
    };
    
    // Save inside active session logs (stored inside session memory, not localStorage to save storage size)
    const logs = getSessionLogs();
    logs.unshift(logItem);
    if (logs.length > 50) logs.pop();
    sessionStorage.setItem('quantum_counter_logs', JSON.stringify(logs));
    
    renderLogs();
}

function getSessionLogs() {
    try {
        const raw = sessionStorage.getItem('quantum_counter_logs');
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function renderLogs() {
    const logs = getSessionLogs();
    if (logs.length === 0) {
        logContainer.innerHTML = '<div class="empty-log-msg">No actions logged yet. Start clicking!</div>';
        return;
    }
    
    logContainer.innerHTML = '';
    logs.forEach(log => {
        const div = document.createElement('div');
        div.className = 'log-item';
        
        let valColorClass = 'text-primary';
        if (log.value > 0) valColorClass = 'text-emerald';
        else if (log.value < 0) valColorClass = 'text-crimson';
        
        div.innerHTML = `
            <span class="log-item-action">${escapeHTML(log.action)} (<span class="${valColorClass}">${log.value}</span>)</span>
            <span class="log-item-time">${log.time}</span>
        `;
        logContainer.appendChild(div);
    });
}

function clearLog() {
    sessionStorage.removeItem('quantum_counter_logs');
    renderLogs();
}


// --- AUTOMATION / AUTO-CLICKER ---

function toggleAutoclicker(forceState) {
    const shouldRun = forceState !== undefined ? forceState : (autoclickerInterval === null);
    
    if (shouldRun) {
        if (autoclickerInterval) clearInterval(autoclickerInterval);
        
        const direction = autoclickerDirection.value;
        const speedHz = parseInt(autoclickerSpeed.value);
        const delta = direction === 'increase' ? state.stepSize : -state.stepSize;
        
        autoclickerInterval = setInterval(() => {
            const success = updateCounterValue(delta, 'auto');
            // If the tick fails (limit reached), success is false and auto-clicker stops
            if (!success) {
                toggleAutoclicker(false);
            }
        }, 1000 / speedHz);
        
        autoclickerToggle.innerHTML = '<span class="play-icon">⏸</span> Stop';
        autoclickerToggle.classList.add('running');
        logAction(`Auto-click Started (${speedHz} Hz)`, getActiveCounter().value);
    } else {
        if (autoclickerInterval) {
            clearInterval(autoclickerInterval);
            autoclickerInterval = null;
        }
        autoclickerToggle.innerHTML = '<span class="play-icon">▶</span> Run';
        autoclickerToggle.classList.remove('running');
        logAction("Auto-click Stopped", getActiveCounter().value);
    }
}


// --- METRIC TIMERS & RUNTIME CALCULATIONS ---

// Live CPS (clicks per second) tracker
function startCpsTracker() {
    cpsInterval = setInterval(() => {
        const now = Date.now();
        // filter timestamps inside the last 2 seconds
        state.stats.clickTimestamps = state.stats.clickTimestamps.filter(t => now - t < 2000);
        
        const count = state.stats.clickTimestamps.length;
        const cps = (count / 2.0).toFixed(1);
        statClickSpeed.textContent = `${cps} cps`;
    }, 200);
}

// Active session elapsed timer
function startSessionTimer() {
    activeTimeInterval = setInterval(() => {
        const elapsedMs = Date.now() - sessionStartTime;
        
        const secs = Math.floor(elapsedMs / 1000) % 60;
        const mins = Math.floor(elapsedMs / (1000 * 60)) % 60;
        const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
        
        const fmt = [
            hours.toString().padStart(2, '0'),
            mins.toString().padStart(2, '0'),
            secs.toString().padStart(2, '0')
        ].join(':');
        
        sessionTimerEl.textContent = fmt;
    }, 1000);
}


// --- EVENTS ATTACHMENTS ---

function attachEventListeners() {
    // 1. Primary buttons
    document.getElementById('increase').addEventListener('click', (e) => {
        updateCounterValue(state.stepSize, 'manual');
        spawnParticleBurst(e.clientX || (canvasWidth / 2), e.clientY || (canvasHeight / 2), 'increment');
    });
    
    document.getElementById('decrease').addEventListener('click', (e) => {
        updateCounterValue(-state.stepSize, 'manual');
        spawnParticleBurst(e.clientX || (canvasWidth / 2), e.clientY || (canvasHeight / 2), 'decrement');
    });
    
    document.getElementById('reset').addEventListener('click', (e) => {
        resetCounter();
        spawnParticleBurst(e.clientX || (canvasWidth / 2), e.clientY || (canvasHeight / 2), 'reset');
    });
    
    // 2. Presets
    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = parseInt(btn.getAttribute('data-preset'));
            updateCounterValue(val, 'preset');
            
            const type = val >= 0 ? 'increment' : 'decrement';
            spawnParticleBurst(e.clientX || (canvasWidth / 2), e.clientY || (canvasHeight / 2), type);
        });
    });
    
    // 3. Step Config
    stepSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.stepSize = val;
        stepInput.value = val;
        updateLabels();
        saveStateToLocalStorage();
    });
    
    stepInput.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 1) val = 1;
        state.stepSize = val;
        stepSlider.value = Math.min(val, 100);
        updateLabels();
        saveStateToLocalStorage();
    });
    
    // 4. Boundary Configs
    minBoundsToggle.addEventListener('change', (e) => {
        state.minBounds.enabled = e.target.checked;
        minBoundsVal.disabled = !e.target.checked;
        if (e.target.checked) {
            validateAndClampValue();
        }
        updateDashboardUI();
        saveStateToLocalStorage();
    });
    
    minBoundsVal.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) val = -50;
        
        // Prevent exceeding max bounds
        if (state.maxBounds.enabled && val >= state.maxBounds.value) {
            val = state.maxBounds.value - 1;
            minBoundsVal.value = val;
        }
        
        state.minBounds.value = val;
        validateAndClampValue();
        updateDashboardUI();
        saveStateToLocalStorage();
    });
    
    maxBoundsToggle.addEventListener('change', (e) => {
        state.maxBounds.enabled = e.target.checked;
        maxBoundsVal.disabled = !e.target.checked;
        if (e.target.checked) {
            validateAndClampValue();
        }
        updateDashboardUI();
        saveStateToLocalStorage();
    });
    
    maxBoundsVal.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) val = 100;
        
        // Prevent dropping below min bounds
        if (state.minBounds.enabled && val <= state.minBounds.value) {
            val = state.minBounds.value + 1;
            maxBoundsVal.value = val;
        }
        
        state.maxBounds.value = val;
        validateAndClampValue();
        updateDashboardUI();
        saveStateToLocalStorage();
    });
    
    function validateAndClampValue() {
        const counterObj = getActiveCounter();
        let val = counterObj.value;
        let clamped = false;
        
        if (state.maxBounds.enabled && val > state.maxBounds.value) {
            val = state.maxBounds.value;
            clamped = true;
        }
        
        if (state.minBounds.enabled && val < state.minBounds.value) {
            val = state.minBounds.value;
            clamped = true;
        }
        
        if (clamped) {
            counterObj.value = val;
            counterObj.lastUpdated = Date.now();
            logAction(`Counter clamped to meet range boundary limits`, val);
            pushToHistory(val);
        }
    }
    
    // 5. Autoclicker Event Bindings
    autoclickerToggle.addEventListener('click', () => {
        toggleAutoclicker();
    });
    
    autoclickerSpeed.addEventListener('input', (e) => {
        const speed = e.target.value;
        speedLabel.textContent = `${speed} Hz`;
        
        // Dynamic speed adjustments while running
        if (autoclickerInterval) {
            toggleAutoclicker(true); // Restart interval at new speed
        }
    });
    
    // 6. Form submissions for collections
    newCounterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = newCounterNameInput.value.trim();
        if (name === '') return;
        
        const newId = 'c_' + Date.now();
        const newCounter = {
            id: newId,
            name: name,
            value: 0,
            lastUpdated: Date.now()
        };
        
        state.counters.push(newCounter);
        newCounterNameInput.value = '';
        
        playSynthesizedSound('milestone');
        logAction(`Created counter "${name}"`, 0);
        
        switchCounter(newId);
    });
    
    // 7. Global action links
    soundToggleBtn.addEventListener('click', () => {
        state.soundEnabled = !state.soundEnabled;
        syncSoundButtonUI();
        saveStateToLocalStorage();
        if (state.soundEnabled) {
            playSynthesizedSound('increment');
        }
    });
    
    themeToggleBtn.addEventListener('click', () => {
        state.glassMode = !state.glassMode;
        syncThemeClass();
        saveStateToLocalStorage();
        playSynthesizedSound('reset');
    });
    
    // 8. Undo / Redo
    undoBtn.addEventListener('click', handleUndo);
    redoBtn.addEventListener('click', handleRedo);
    
    // 9. Extra actions
    clearLogBtn.addEventListener('click', clearLog);
    
    exportDataBtn.addEventListener('click', () => {
        const fullData = {
            counters: state.counters,
            activeCounterId: state.activeCounterId,
            settings: {
                stepSize: state.stepSize,
                minBounds: state.minBounds,
                maxBounds: state.maxBounds,
                soundEnabled: state.soundEnabled,
                glassMode: state.glassMode
            },
            logs: getSessionLogs(),
            timestamp: new Date().toISOString()
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href",     dataStr);
        downloadAnchor.setAttribute("download", `quantum-counter-data-${Date.now()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        
        playSynthesizedSound('milestone');
        logAction("Data collections exported", getActiveCounter().value);
    });
    
    // 10. Accordion folding
    accordionTrigger.addEventListener('click', () => {
        accordionSection.classList.toggle('expanded');
    });
    
    // Keybind support (Premium touch!)
    window.addEventListener('keydown', (e) => {
        // Prevent events triggering inside text inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const code = e.code;
        if (code === 'ArrowUp' || code === 'Equal' || code === 'NumpadAdd') {
            e.preventDefault();
            updateCounterValue(state.stepSize, 'manual');
            spawnParticleBurst(canvasWidth / 2, canvasHeight / 2, 'increment');
        } else if (code === 'ArrowDown' || code === 'Minus' || code === 'NumpadSubtract') {
            e.preventDefault();
            updateCounterValue(-state.stepSize, 'manual');
            spawnParticleBurst(canvasWidth / 2, canvasHeight / 2, 'decrement');
        } else if (code === 'KeyR') {
            e.preventDefault();
            resetCounter();
            spawnParticleBurst(canvasWidth / 2, canvasHeight / 2, 'reset');
        } else if (code === 'KeyZ' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (e.shiftKey) {
                handleRedo();
            } else {
                handleUndo();
            }
        } else if (code === 'KeyY' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleRedo();
        } else if (code === 'Space') {
            e.preventDefault();
            toggleAutoclicker();
        }
    });
}


// --- GENERAL HELPER UTILITIES ---

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}


// --- INITIALIZATION ---

function init() {
    loadSavedData();
    attachEventListeners();
    startCpsTracker();
    startSessionTimer();
    
    // Kickstart the background canvas rendering loop
    animateParticles();
}

// Fire initialization when DOM content loaded
document.addEventListener('DOMContentLoaded', init);
// Backup launch trigger if DOM loaded already
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    init();
}