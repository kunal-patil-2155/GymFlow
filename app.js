/* ============================================================
   GymFlow – app.js
   Skill: Ponytail (full) — smallest complete solution
   No framework, no dependencies, vanilla JS + LocalStorage
   ============================================================ */

'use strict';

/* ── STORAGE MODULE ──────────────────────────────────────────
   shortcut: single JSON key; upgrade to IndexedDB if >1MB data  */
const Storage = {
  KEY: 'gymflow_state',

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      // corrupted storage — fall back to defaults
      return null;
    }
  },

  save(state) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(state));
      this.showSaveError(false);
      return true;
    } catch (e) {
      // quota exceeded or private-mode restriction
      console.warn('GymFlow: could not save state', e);
      this.showSaveError(true);
      return false;
    }
  },

  showSaveError(show) {
    const banner = document.getElementById('storage-error-banner');
    if (banner) banner.hidden = !show;
  },

  clear() {
    try {
      localStorage.removeItem(this.KEY);
      this.showSaveError(false);
    } catch { /* ignore */ }
  }
};

/* ── SAMPLE DATA ─────────────────────────────────────────────
   Clearly identified as sample data. Loaded only when storage empty. */
function makeSampleData() {
  const today = todayKey();
  return {
    _isSampleData: true,
    routines: [
      {
        id: 'sample-1',
        name: 'Push Day',
        category: 'chest',
        exercises: [
          { id: 'e1', name: 'Bench Press',      sets: 4, reps: 8,  rest: 90 },
          { id: 'e2', name: 'Incline Dumbbell', sets: 3, reps: 10, rest: 60 },
          { id: 'e3', name: 'Push-ups',         sets: 3, reps: 15, rest: 45 },
          { id: 'e4', name: 'Tricep Dips',      sets: 3, reps: 12, rest: 60 },
        ]
      },
      {
        id: 'sample-2',
        name: 'Pull Day',
        category: 'back',
        exercises: [
          { id: 'e5', name: 'Pull-ups',         sets: 4, reps: 6,  rest: 90 },
          { id: 'e6', name: 'Barbell Row',      sets: 3, reps: 8,  rest: 90 },
          { id: 'e7', name: 'Cable Row',        sets: 3, reps: 12, rest: 60 },
          { id: 'e8', name: 'Bicep Curls',      sets: 3, reps: 15, rest: 45 },
        ]
      }
    ],
    today: {
      date: today,
      routineId: 'sample-1',   // Push Day is today's routine
      completed: [],
      water: []
    },
    weekly: buildEmptyWeek(),
    history: [],
    goals: {
      workouts:  1,
      exercises: 8,
      water:     2000
    }
  };
}

/* ── STATE MODULE ────────────────────────────────────────────
   In-memory single source of truth; persists on every write.    */
const State = {
  _data: null,
  _subs: [],

  init() {
    const saved = Storage.load();
    this._data = saved || makeSampleData();
    if (!Array.isArray(this._data.history)) this._data.history = [];
    const today = todayKey();

    // Migrate today's date if day changed (calendar-day transition)
    if (this._data.today.date !== today) {
      archiveDayToHistory(this._data, this._data.today.date);
      this._data.today.date = today;
      this._data.today.completed = [];
      this._data.today.water = [];
      // Keep selected routine if it still exists
      const hasValidRoutine = this._data.routines.some(r => r.id === this._data.today.routineId);
      if (!hasValidRoutine && this._data.routines.length > 0) {
        this._data.today.routineId = this._data.routines[0].id;
      }
      ensureWeeklyRolling(this._data);
      this._persist();
    } else {
      ensureWeeklyRolling(this._data);
      this._persist();
    }
  },

  get() { return this._data; },

  set(updater) {
    updater(this._data);
    const saved = this._persist();
    this._notify();
    return saved;
  },

  subscribe(fn) { this._subs.push(fn); },

  _persist() { return Storage.save(this._data); },

  _notify() { this._subs.forEach(fn => fn(this._data)); }
};

/* ── UTILITIES ───────────────────────────────────────────────*/
function toLocalDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey() {
  return toLocalDateKey(new Date());
}

function parseLocalDate(dateStr) {
  if (typeof dateStr !== 'string') return new Date();
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(dateStr);
}

function getRolling7DateKeys() {
  const keys = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(toLocalDateKey(d));
  }
  return keys;
}

function buildEmptyWeek() {
  return getRolling7DateKeys().map(date => ({ date, completed: 0, total: 0 }));
}

function archiveDayToHistory(d, dateKey) {
  if (!Array.isArray(d.history)) d.history = [];
  const existingIdx = d.history.findIndex(h => h && h.date === dateKey);
  const routine = d.routines.find(r => r.id === d.today.routineId);
  const waterTotal = Array.isArray(d.today.water) ? d.today.water.reduce((sum, e) => sum + e.ml, 0) : 0;
  const completedCount = Array.isArray(d.today.completed) ? d.today.completed.length : 0;
  const totalCount = routine ? routine.exercises.length : 0;
  const entry = {
    date: dateKey,
    routineId: d.today.routineId,
    routineName: routine ? routine.name : 'Rest Day',
    category: routine ? routine.category : 'chest',
    completed: completedCount,
    total: totalCount,
    water: waterTotal
  };
  if (existingIdx !== -1) {
    d.history[existingIdx] = entry;
  } else {
    d.history.push(entry);
  }
  if (d.history.length > 60) {
    d.history = d.history.slice(-60);
  }
}

function syncTodayWeekly(d) {
  const today = todayKey();
  const routine = d.routines.find(r => r.id === d.today.routineId);
  let w = d.weekly.find(day => day.date === today);
  if (!w) {
    w = { date: today, completed: 0, total: 0 };
    d.weekly.push(w);
  }
  w.total = routine ? routine.exercises.length : 0;
  w.completed = Array.isArray(d.today.completed) ? d.today.completed.length : 0;
  archiveDayToHistory(d, today);
}

function ensureWeeklyRolling(d) {
  if (!Array.isArray(d.weekly)) {
    d.weekly = buildEmptyWeek();
  }
  const rollingKeys = getRolling7DateKeys();
  const existingMap = new Map();
  d.weekly.forEach(entry => {
    if (entry && entry.date) {
      existingMap.set(entry.date, entry);
    }
  });

  // Keep rolling 7 calendar days strictly ordered
  d.weekly = rollingKeys.map(date => {
    if (existingMap.has(date)) {
      return existingMap.get(date);
    }
    return { date, completed: 0, total: 0 };
  });

  syncTodayWeekly(d);
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric'
  });
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatExerciseMeta(ex) {
  const parts = [];
  if (ex.sets) parts.push(`${ex.sets} sets`);
  if (ex.reps) parts.push(`${ex.reps} reps`);
  if (ex.duration) {
    const m = Math.floor(ex.duration / 60);
    const s = ex.duration % 60;
    parts.push(m > 0 ? (s > 0 ? `${m}m ${s}s` : `${m}m`) : `${s}s`);
  }
  if (ex.rest) parts.push(`${ex.rest}s rest`);
  return parts.join(' · ') || 'No details';
}

function formatExerciseCompact(ex) {
  let str = '';
  if (ex.sets && ex.reps) str = `${ex.sets}×${ex.reps}`;
  else if (ex.sets && ex.duration) str = `${ex.sets}×${ex.duration}s`;
  else if (ex.sets) str = `${ex.sets} sets`;
  else if (ex.duration) str = `${ex.duration}s`;
  if (ex.rest) str += (str ? ' · ' : '') + `${ex.rest}s`;
  return str || '–';
}

// Safe DOM helpers — never use innerHTML with user data
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'textContent') node.textContent = v;
    else if (k.startsWith('data-')) node.setAttribute(k, v);
    else if (k === 'ariaLabel') node.setAttribute('aria-label', v);
    else node[k] = v;
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function setText(id, text) {
  const node = document.getElementById(id);
  if (node) node.textContent = text;
}

function setWidth(id, pct) {
  const node = document.getElementById(id);
  if (node) node.style.width = clamp(pct, 0, 100) + '%';
}

/**
 * Smooth numeric counter animation with prefers-reduced-motion compliance.
 * @param {HTMLElement|string} targetEl Element or element ID
 * @param {number} target Final numeric value
 * @param {number} [duration=400] Animation duration in ms
 * @param {Function} [formatFn] Formatting function
 */
function animateNumber(targetEl, target, duration = 400, formatFn = Math.round) {
  const el = typeof targetEl === 'string' ? document.getElementById(targetEl) : targetEl;
  if (!el) return;

  const reducedMotion = typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion || duration <= 0) {
    el.textContent = formatFn(target);
    return;
  }

  const currentText = (el.textContent || '').replace(/[^0-9.-]/g, '');
  const start = parseFloat(currentText) || 0;
  if (Math.round(start) === Math.round(target)) {
    el.textContent = formatFn(target);
    return;
  }

  const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const easeOut = 1 - (1 - progress) * (1 - progress);
    const current = start + (target - start) * easeOut;
    el.textContent = formatFn(current);
    if (progress < 1) {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(step);
      } else {
        el.textContent = formatFn(target);
      }
    } else {
      el.textContent = formatFn(target);
    }
  }
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(step);
  } else {
    el.textContent = formatFn(target);
  }
}

function showError(id, msg) {
  const node = document.getElementById(id);
  if (!node) return;
  node.textContent = msg;
  node.hidden = !msg;
}

function clearError(id) { showError(id, ''); }

function markInvalid(inputEl, invalid) {
  inputEl.classList.toggle('invalid', invalid);
  inputEl.setAttribute('aria-invalid', invalid ? 'true' : 'false');
}

/* ── ROUTER ──────────────────────────────────────────────────
   Hash-based: #dashboard, #routines, #water, #weekly, #goals   */
const VIEWS = ['dashboard', 'routines', 'water', 'weekly', 'goals'];

function navigate(view) {
  if (!VIEWS.includes(view)) view = 'dashboard';

  VIEWS.forEach(v => {
    const section = document.getElementById('view-' + v);
    if (section) {
      const isActive = v === view;
      section.hidden = !isActive;
      if (isActive) {
        section.classList.remove('fade-in');
        if (typeof section.offsetWidth !== 'undefined') {
          void section.offsetWidth; // trigger reflow for smooth animation
        }
        section.classList.add('fade-in');
      }
    }
  });

  // Update nav links
  document.querySelectorAll('[data-view]').forEach(link => {
    const active = link.dataset.view === view;
    link.classList.toggle('active', active);
    if (link.tagName === 'A') {
      link.setAttribute('aria-current', active ? 'page' : 'false');
    }
  });

  // Render the activated view
  if (view === 'dashboard') renderDashboard();
  if (view === 'routines')  renderRoutines();
  if (view === 'water')     renderWater();
  if (view === 'weekly')    renderWeekly();
  if (view === 'goals')     renderGoals();
}

function initRouter() {
  function route() {
    const hash = location.hash.replace('#', '') || 'dashboard';
    navigate(hash);
  }
  window.addEventListener('hashchange', route);
  route();

  // Allow data-view links to trigger navigate
  document.addEventListener('click', e => {
    const link = e.target.closest('[data-view]');
    if (!link) return;
    const view = link.dataset.view;
    if (!VIEWS.includes(view)) return;
    location.hash = view;
  });
}

/* ── DASHBOARD RENDER ────────────────────────────────────────*/
function renderDashboard() {
  const s = State.get();

  // Date subtitle
  setText('dashboard-date', formatDate(todayKey()));

  // Sample data banner
  const banner = document.getElementById('sample-banner');
  if (banner) banner.hidden = !s._isSampleData;

  // Find today's routine
  let routine = s.routines.find(r => r.id === s.today.routineId);
  if (!routine && s.routines.length > 0) {
    routine = s.routines[0];
    State.set(d => {
      d.today.routineId = routine.id;
      d.today.completed = [];
      syncTodayWeekly(d);
    });
  }

  if (routine) {
    setText('stat-workout-name', routine.name);
    setText('stat-workout-category', routine.category.charAt(0).toUpperCase() + routine.category.slice(1));
  } else {
    setText('stat-workout-name', 'No routine');
    setText('stat-workout-category', '–');
  }

  // Exercise progress
  const total = routine ? routine.exercises.length : 0;
  const done  = s.today.completed.length;
  setText('stat-exercises-done', `${done} / ${total}`);
  const exPct = total ? Math.round((done / total) * 100) : 0;
  setWidth('progress-exercises', exPct);
  const exBar = document.getElementById('progress-exercises');
  if (exBar) exBar.classList.toggle('complete', exPct === 100);

  // Water
  const waterTotal = s.today.water.reduce((sum, e) => sum + e.ml, 0);
  setText('stat-water', waterTotal + ' ml');
  setText('stat-water-goal', 'Goal: ' + s.goals.water + ' ml');

  // Goal progress (composite: exercise + water)
  const goalExPct  = total ? clamp(done / (s.goals.exercises || 1), 0, 1) : 0;
  const goalWatPct = clamp(waterTotal / Math.max(1, s.goals.water), 0, 1);
  const goalPct    = Math.round(((goalExPct + goalWatPct) / 2) * 100);
  setText('stat-goal-pct', goalPct + '%');
  setWidth('progress-goal', goalPct);

  // Concentric Biometric Flow HUD
  const watGoalVal = Math.max(1, s.goals.water || 2000);
  const watPct = clamp(Math.round((waterTotal / watGoalVal) * 100), 0, 100);
  const flowPct = Math.round((exPct + watPct) / 2);

  const ringEx = document.getElementById('ring-exercises-fill');
  if (ringEx) {
    const offset = Math.round(302 - (clamp(exPct, 0, 100) / 100) * 302);
    ringEx.style.strokeDashoffset = offset;
    ringEx.classList.toggle('complete', exPct >= 100);
  }
  const ringWat = document.getElementById('ring-water-fill');
  if (ringWat) {
    const offset = Math.round(226 - (clamp(watPct, 0, 100) / 100) * 226);
    ringWat.style.strokeDashoffset = offset;
    ringWat.classList.toggle('complete', watPct >= 100);
  }

  animateNumber('concentric-pct-display', flowPct, 350, n => Math.round(n) + '%');

  setText('flow-stat-exercises', `${done} / ${total}`);
  setText('flow-stat-water', `${waterTotal.toLocaleString()} / ${watGoalVal.toLocaleString()} ml`);
  const streakDays = calculateStreak(s.weekly || [], s.history || []);
  setText('flow-stat-streak', streakDays > 0 ? `${streakDays} Day${streakDays === 1 ? '' : 's'} Active` : 'Active Lock');

  // Milestone Celebration Banner
  const milestoneBanner = document.getElementById('milestone-banner');
  if (milestoneBanner) {
    const dismissedKey = 'gymflow_milestone_dismissed_' + todayKey();
    let isDismissed = false;
    try {
      isDismissed = typeof sessionStorage !== 'undefined' && sessionStorage.getItem(dismissedKey) === '1';
    } catch (e) {
      isDismissed = false;
    }
    const isMilestone = total > 0 && exPct >= 100 && watPct >= 100;
    milestoneBanner.hidden = !(isMilestone && !isDismissed);
  }

  // Exercise list (today's routine)
  const listEl   = document.getElementById('dashboard-exercise-list');
  const emptyEl  = document.getElementById('dashboard-empty');
  if (!listEl || !emptyEl) return;

  if (!routine) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  listEl.innerHTML = '';

  routine.exercises.forEach(ex => {
    const isDone = s.today.completed.includes(ex.id);
    const item = document.createElement('li');
    item.className = 'exercise-item' + (isDone ? ' done' : '');

    const checkbox = document.createElement('button');
    checkbox.className = 'exercise-checkbox';
    checkbox.type = 'button';
    checkbox.setAttribute('aria-label', (isDone ? 'Mark incomplete: ' : 'Mark complete: ') + ex.name);
    checkbox.setAttribute('aria-pressed', isDone ? 'true' : 'false');
    checkbox.innerHTML = isDone
      ? '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '';
    checkbox.addEventListener('click', () => {
      State.set(d => {
        const idx = d.today.completed.indexOf(ex.id);
        if (idx === -1) d.today.completed.push(ex.id);
        else d.today.completed.splice(idx, 1);
        syncTodayWeekly(d);
      });
      renderDashboard();
    });

    const name = document.createElement('span');
    name.className = 'exercise-name';
    name.textContent = ex.name;

    const meta = document.createElement('span');
    meta.className = 'exercise-meta';
    meta.textContent = formatExerciseCompact(ex);

    item.appendChild(checkbox);
    item.appendChild(name);
    item.appendChild(meta);
    listEl.appendChild(item);
  });
}

/* ── ROUTINES RENDER ─────────────────────────────────────────*/
let _currentCategoryFilter = 'all';

function renderRoutines() {
  const s = State.get();
  const listEl  = document.getElementById('routines-list');
  const emptyEl = document.getElementById('routines-empty');
  if (!listEl || !emptyEl) return;

  // Update filter pills active class
  document.querySelectorAll('.category-filters .filter-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.filter === _currentCategoryFilter);
  });

  const routinesToDisplay = _currentCategoryFilter === 'all'
    ? s.routines
    : s.routines.filter(r => r.category === _currentCategoryFilter);

  listEl.innerHTML = '';

  if (s.routines.length === 0) {
    emptyEl.hidden = false;
    const p = emptyEl.querySelector('p');
    if (p) p.textContent = 'No routines yet. Create your first workout routine.';
    return;
  }

  if (routinesToDisplay.length === 0) {
    emptyEl.hidden = false;
    const p = emptyEl.querySelector('p');
    const catName = _currentCategoryFilter.charAt(0).toUpperCase() + _currentCategoryFilter.slice(1);
    if (p) p.textContent = `No ${catName} routines found. Create one or select All Muscle Groups.`;
    return;
  }
  emptyEl.hidden = true;

  routinesToDisplay.forEach(routine => {
    const isToday = s.today.routineId === routine.id;

    const card = document.createElement('div');
    card.className = 'routine-card';
    card.setAttribute('role', 'listitem');

    // Header
    const header = document.createElement('div');
    header.className = 'routine-header';

    const titleBlock = document.createElement('div');
    titleBlock.className = 'routine-title-block';

    const name = document.createElement('div');
    name.className = 'routine-name';
    name.textContent = routine.name;

    const badge = document.createElement('div');
    badge.className = `category-badge category-${routine.category}`;
    badge.textContent = routine.category.charAt(0).toUpperCase() + routine.category.slice(1);

    if (isToday) {
      const todayBadge = document.createElement('span');
      todayBadge.style.cssText = 'margin-left:8px;font-size:0.7rem;color:var(--color-accent);font-weight:600;';
      todayBadge.textContent = '● Today';
      badge.appendChild(todayBadge);
    }

    titleBlock.appendChild(name);
    titleBlock.appendChild(badge);

    const actions = document.createElement('div');
    actions.className = 'routine-actions';

    // Set as today button
    const btnToday = document.createElement('button');
    btnToday.className = 'btn btn-sm btn-secondary';
    btnToday.type = 'button';
    btnToday.textContent = isToday ? 'Today ✓' : 'Set as Today';
    btnToday.setAttribute('aria-label', (isToday ? 'Currently set as today\'s routine: ' : 'Set as today\'s routine: ') + routine.name);
    btnToday.disabled = isToday;
    btnToday.addEventListener('click', () => {
      State.set(d => {
        if (d.today.routineId !== routine.id) {
          d.today.routineId = routine.id;
          d.today.completed = [];
          syncTodayWeekly(d);
        }
      });
      renderRoutines();
      renderDashboard();
    });

    // Edit button
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn-icon';
    btnEdit.type = 'button';
    btnEdit.setAttribute('aria-label', 'Edit routine: ' + routine.name);
    btnEdit.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2 L14 5 L5 14 L2 14 L2 11 Z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/><line x1="9" y1="4" x2="12" y2="7" stroke="currentColor" stroke-width="1.4"/></svg>';
    btnEdit.addEventListener('click', () => openRoutineModal(routine.id));

    // Delete button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-icon danger';
    btnDelete.type = 'button';
    btnDelete.setAttribute('aria-label', 'Delete routine: ' + routine.name);
    btnDelete.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="6" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/><line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="6" y1="2" x2="10" y2="2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    btnDelete.addEventListener('click', () => openDeleteRoutineModal(routine));

    actions.appendChild(btnToday);
    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);

    header.appendChild(titleBlock);
    header.appendChild(actions);
    card.appendChild(header);

    // Exercise rows
    const exList = document.createElement('div');
    exList.className = 'routine-exercises';
    routine.exercises.forEach(ex => {
      const row = document.createElement('div');
      row.className = 'routine-exercise-row';

      const exName = document.createElement('span');
      exName.className = 'routine-exercise-name';
      exName.textContent = ex.name;

      const exMeta = document.createElement('span');
      exMeta.className = 'routine-exercise-meta';
      exMeta.textContent = formatExerciseMeta(ex);

      row.appendChild(exName);
      row.appendChild(exMeta);
      exList.appendChild(row);
    });
    card.appendChild(exList);

    listEl.appendChild(card);
  });
}

/* ── ROUTINE MODAL ───────────────────────────────────────────*/
let _editingRoutineId = null;

function openRoutineModal(routineId = null) {
  _editingRoutineId = routineId;
  const modal = document.getElementById('modal-routine');
  const title = document.getElementById('modal-routine-title');
  if (!modal) return;

  title.textContent = routineId ? 'Edit Routine' : 'New Routine';

  // Clear form
  const form = document.getElementById('routine-form');
  form.reset();
  document.getElementById('exercises-fields').innerHTML = '';
  clearError('routine-name-error');
  clearError('exercises-error');

  if (routineId) {
    const routine = State.get().routines.find(r => r.id === routineId);
    if (routine) {
      document.getElementById('routine-name').value = routine.name;
      document.getElementById('routine-category').value = routine.category;
      routine.exercises.forEach(ex => addExerciseField(ex));
    }
  } else {
    addExerciseField(); // start with one empty row
  }

  modal.hidden = false;
  document.getElementById('routine-name').focus();
}

function closeRoutineModal() {
  const modal = document.getElementById('modal-routine');
  if (modal) modal.hidden = true;
  _editingRoutineId = null;
}

function addExerciseField(ex = {}) {
  const fields = document.getElementById('exercises-fields');
  const idx    = fields.children.length;

  const row = document.createElement('div');
  row.className = 'exercise-field-row';
  row.dataset.exerciseId = ex.id || uid();

  const nameGroup = document.createElement('div');
  const nameLabel = document.createElement('label');
  nameLabel.className = 'exercise-field-label';
  nameLabel.textContent = idx === 0 ? 'Exercise name' : ' ';
  const nameInput = document.createElement('input');
  nameInput.type = 'text'; nameInput.className = 'input';
  nameInput.placeholder = 'e.g. Bench Press';
  nameInput.maxLength = 60;
  nameInput.value = ex.name || '';
  nameInput.setAttribute('aria-label', 'Exercise name');
  nameGroup.appendChild(nameLabel); nameGroup.appendChild(nameInput);

  const makeNumField = (labelText, placeholder, val, min, max, ariaLabel) => {
    const g = document.createElement('div');
    const l = document.createElement('label');
    l.className = 'exercise-field-label';
    l.textContent = idx === 0 ? labelText : ' ';
    const inp = document.createElement('input');
    inp.type = 'number'; inp.className = 'input';
    inp.placeholder = placeholder; inp.min = min; inp.max = max;
    inp.value = val || '';
    inp.setAttribute('aria-label', ariaLabel);
    g.appendChild(l); g.appendChild(inp);
    return g;
  };

  const setsGroup = makeNumField('Sets', '3', ex.sets, 1, 50, 'Number of sets');
  const repsGroup = makeNumField('Reps', '10', ex.reps, 0, 200, 'Reps per set');
  const durGroup  = makeNumField('Dur (s)', '60', ex.duration, 0, 3600, 'Duration in seconds');
  const restGroup = makeNumField('Rest (s)', '60', ex.rest, 0, 600, 'Rest in seconds');

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button'; removeBtn.className = 'btn-icon danger';
  removeBtn.setAttribute('aria-label', 'Remove exercise');
  removeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><line x1="3" y1="3" x2="13" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="13" y1="3" x2="3" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  removeBtn.addEventListener('click', () => {
    row.remove();
    clearError('exercises-error');
  });

  row.appendChild(nameGroup);
  row.appendChild(setsGroup);
  row.appendChild(repsGroup);
  row.appendChild(durGroup);
  row.appendChild(restGroup);
  row.appendChild(removeBtn);
  fields.appendChild(row);
}

function collectExercises() {
  const rows = document.querySelectorAll('#exercises-fields .exercise-field-row');
  const exercises = [];
  for (const row of rows) {
    const inputs = row.querySelectorAll('input');
    const name = inputs[0].value.trim();
    if (!name) return null; // signals validation failure
    const sets = parseInt(inputs[1].value, 10) || 0;
    const reps = parseInt(inputs[2].value, 10) || 0;
    const duration = parseInt(inputs[3].value, 10) || 0;
    const rest = parseInt(inputs[4].value, 10) || 0;
    const id = row.dataset.exerciseId || uid();
    exercises.push({ id, name, sets, reps, duration, rest });
  }
  return exercises;
}

function initRoutineModal() {
  document.getElementById('btn-add-routine')?.addEventListener('click', () => openRoutineModal());
  document.getElementById('btn-add-routine-empty')?.addEventListener('click', () => openRoutineModal());
  document.getElementById('modal-close-routine')?.addEventListener('click', closeRoutineModal);
  document.getElementById('btn-cancel-routine')?.addEventListener('click', closeRoutineModal);
  document.getElementById('btn-add-exercise')?.addEventListener('click', () => {
    addExerciseField();
    clearError('exercises-error');
  });

  // Close on backdrop click
  document.getElementById('modal-routine')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeRoutineModal();
  });

  // Close on Esc
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (!document.getElementById('modal-routine')?.hidden)        closeRoutineModal();
      if (!document.getElementById('modal-reset')?.hidden)          closeResetModal();
      if (!document.getElementById('modal-delete-routine')?.hidden) closeDeleteRoutineModal();
    }
  });

  document.getElementById('routine-form')?.addEventListener('submit', e => {
    e.preventDefault();
    let valid = true;

    const nameInput = document.getElementById('routine-name');
    const name = nameInput.value.trim();
    if (!name) {
      showError('routine-name-error', 'Routine name is required.');
      markInvalid(nameInput, true);
      nameInput.focus();
      valid = false;
    } else {
      clearError('routine-name-error');
      markInvalid(nameInput, false);
    }

    if (document.querySelectorAll('#exercises-fields .exercise-field-row').length === 0) {
      showError('exercises-error', 'Add at least one exercise.');
      valid = false;
    }

    if (!valid) return;

    const exercises = collectExercises();
    if (!exercises) {
      showError('exercises-error', 'Each exercise must have a name.');
      return;
    }
    if (exercises.length === 0) {
      showError('exercises-error', 'Add at least one exercise.');
      return;
    }

    const category = document.getElementById('routine-category').value;

    State.set(d => {
      d._isSampleData = false;
      if (_editingRoutineId) {
        const idx = d.routines.findIndex(r => r.id === _editingRoutineId);
        if (idx !== -1) {
          d.routines[idx] = { id: _editingRoutineId, name, category, exercises };
          // If editing today's routine, preserve completion status for exercises that still exist,
          // and remove completion references for exercises that were deleted
          if (d.today.routineId === _editingRoutineId) {
            const activeIds = new Set(exercises.map(e => e.id));
            d.today.completed = (d.today.completed || []).filter(id => activeIds.has(id));
            syncTodayWeekly(d);
          }
        }
      } else {
        const newRoutine = { id: uid(), name, category, exercises };
        d.routines.push(newRoutine);
        // Auto-set as today if no routine is set
        if (!d.today.routineId) {
          d.today.routineId = newRoutine.id;
          d.today.completed = [];
          syncTodayWeekly(d);
        }
      }
    });

    closeRoutineModal();
    renderRoutines();
    renderDashboard();
  });
}

/* ── DELETE ROUTINE MODAL ────────────────────────────────────*/
let _routineToDelete = null;

function openDeleteRoutineModal(routine) {
  _routineToDelete = routine;
  const modal = document.getElementById('modal-delete-routine');
  if (!modal) return;
  setText('modal-delete-routine-msg', `Are you sure you want to delete "${routine.name}"? This action cannot be undone.`);
  modal.hidden = false;
  document.getElementById('btn-cancel-delete-routine')?.focus();
}

function closeDeleteRoutineModal() {
  const modal = document.getElementById('modal-delete-routine');
  if (modal) modal.hidden = true;
  _routineToDelete = null;
}

function initDeleteRoutineModal() {
  document.getElementById('modal-close-delete-routine')?.addEventListener('click', closeDeleteRoutineModal);
  document.getElementById('btn-cancel-delete-routine')?.addEventListener('click', closeDeleteRoutineModal);
  document.getElementById('modal-delete-routine')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDeleteRoutineModal();
  });
  document.getElementById('btn-confirm-delete-routine')?.addEventListener('click', () => {
    if (!_routineToDelete) return;
    const toDeleteId = _routineToDelete.id;
    State.set(d => {
      d.routines = d.routines.filter(r => r.id !== toDeleteId);
      if (d.today.routineId === toDeleteId) {
        d.today.routineId = d.routines[0]?.id || null;
        d.today.completed = [];
        syncTodayWeekly(d);
      }
      d._isSampleData = false;
    });
    closeDeleteRoutineModal();
    renderRoutines();
    renderDashboard();
  });
}

function initRoutinesFilter() {
  document.querySelectorAll('.category-filters .filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      _currentCategoryFilter = pill.dataset.filter || 'all';
      renderRoutines();
    });
  });
}

/* ── WATER RENDER ────────────────────────────────────────────*/
function renderWater() {
  const s = State.get();
  const total = s.today.water.reduce((sum, e) => sum + e.ml, 0);
  const goal  = s.goals.water;
  const pct   = Math.round(clamp(total / Math.max(1, goal), 0, 1) * 100);

  setText('water-total-display', total);
  setText('water-goal-display',  goal);
  setWidth('water-progress-bar', pct);

  const bar = document.getElementById('water-progress-bar');
  if (bar) bar.classList.toggle('complete', pct >= 100);

  // Dynamic fluid wave reservoir
  const fluidFill = document.getElementById('water-fluid-fill');
  if (fluidFill) {
    fluidFill.style.height = `${pct}%`;
  }

  // Goal input
  const goalInput = document.getElementById('water-goal-input');
  if (goalInput && goalInput !== document.activeElement) goalInput.value = goal;

  // Entries list
  const listEl  = document.getElementById('water-entries-list');
  const emptyEl = document.getElementById('water-empty');
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = '';

  if (s.today.water.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  // Show newest first
  [...s.today.water].reverse().forEach(entry => {
    const item = document.createElement('li');
    item.className = 'water-entry';

    const left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:12px;';

    const amount = document.createElement('span');
    amount.className = 'water-entry-amount';
    amount.textContent = entry.ml + ' ml';

    const time = document.createElement('span');
    time.className = 'water-entry-time';
    time.textContent = formatTime(entry.at);

    left.appendChild(amount);
    left.appendChild(time);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove-water';
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove ${entry.ml} ml entry at ${formatTime(entry.at)}`);
    removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    removeBtn.addEventListener('click', () => {
      State.set(d => { d.today.water = d.today.water.filter(e => e.at !== entry.at); });
      renderWater();
      renderDashboard();
    });

    item.appendChild(left);
    item.appendChild(removeBtn);
    listEl.appendChild(item);
  });
}

function validateAndAddWater(mlRaw) {
  const ml = parseInt(mlRaw, 10);
  if (!mlRaw || isNaN(ml) || ml < 1) {
    showError('water-input-error', 'Enter a positive number (ml).');
    markInvalid(document.getElementById('water-amount-input'), true);
    return false;
  }
  if (ml > 2000) {
    showError('water-input-error', 'Single entry cannot exceed 2000 ml.');
    markInvalid(document.getElementById('water-amount-input'), true);
    return false;
  }
  clearError('water-input-error');
  markInvalid(document.getElementById('water-amount-input'), false);
  State.set(d => {
    d.today.water.push({ ml, at: new Date().toISOString() });
    d._isSampleData = false;
  });
  renderWater();
  renderDashboard();
  return true;
}

function initWater() {
  document.getElementById('btn-add-water')?.addEventListener('click', () => {
    const input = document.getElementById('water-amount-input');
    if (validateAndAddWater(input.value)) input.value = '';
  });

  document.getElementById('water-amount-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const input = e.currentTarget;
      if (validateAndAddWater(input.value)) input.value = '';
    }
  });

  document.querySelectorAll('.quick-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const ml = parseInt(btn.dataset.ml, 10);
      State.set(d => {
        d.today.water.push({ ml, at: new Date().toISOString() });
        d._isSampleData = false;
      });
      renderWater();
      renderDashboard();
    });
  });

  document.getElementById('btn-save-water-goal')?.addEventListener('click', () => {
    const input = document.getElementById('water-goal-input');
    const val = parseInt(input.value, 10);
    if (isNaN(val) || val < 100 || val > 10000) {
      showError('water-goal-error', 'Enter a goal between 100 and 10,000 ml.');
      markInvalid(input, true);
      return;
    }
    clearError('water-goal-error');
    markInvalid(input, false);
    State.set(d => { d.goals.water = val; });
    renderWater();
    renderGoals();
    renderDashboard();
  });
}

function calculateStreak(week = [], history = []) {
  const today = todayKey();
  const histMap = new Map();
  if (Array.isArray(history)) {
    history.forEach(h => { if (h && h.date) histMap.set(h.date, h); });
  }
  if (Array.isArray(week)) {
    week.forEach(w => { if (w && w.date) histMap.set(w.date, w); });
  }

  let streak = 0;
  const curr = parseLocalDate(today);
  const todayEntry = histMap.get(today);
  const todayDone = todayEntry && todayEntry.completed > 0;

  if (todayDone) {
    streak = 1;
    curr.setDate(curr.getDate() - 1);
  } else {
    // If not completed today yet, check if yesterday was done (keeps streak alive)
    curr.setDate(curr.getDate() - 1);
  }

  while (true) {
    const key = toLocalDateKey(curr);
    const entry = histMap.get(key);
    if (entry && entry.completed > 0) {
      streak++;
      curr.setDate(curr.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/* ── WEEKLY RENDER ───────────────────────────────────────────*/
function renderWeekly() {
  const s = State.get();

  // Ensure weekly array covers the rolling 7 local calendar days
  ensureWeeklyRolling(s);
  const week = s.weekly;

  // SVG bar chart
  const svgEl = document.getElementById('weekly-chart');
  if (!svgEl) return;

  const W = 560, H = 220, padL = 40, padR = 20, padT = 20, padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW   = Math.floor(chartW / 7) - 8;
  const barGap = Math.floor(chartW / 7);

  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const svgNS = 'http://www.w3.org/2000/svg';

  svgEl.innerHTML = '';

  // Baseline
  const baseline = document.createElementNS(svgNS, 'line');
  baseline.setAttribute('x1', padL); baseline.setAttribute('y1', padT + chartH);
  baseline.setAttribute('x2', padL + chartW); baseline.setAttribute('y2', padT + chartH);
  baseline.setAttribute('stroke', 'var(--color-chart-empty)');
  baseline.setAttribute('stroke-width', '1');
  svgEl.appendChild(baseline);

  const tableBody = document.getElementById('weekly-chart-table-body');
  if (tableBody) tableBody.innerHTML = '';

  const trendPoints = [];

  week.forEach((day, i) => {
    const pct = day.total ? clamp(day.completed / day.total, 0, 1) : 0;
    const barH = Math.max(pct > 0 ? 4 : 0, Math.round(pct * chartH));
    const x    = padL + i * barGap + (barGap - barW) / 2;
    const y    = padT + chartH - barH;
    const isToday = day.date === todayKey();

    trendPoints.push({ x: x + barW / 2, y, pct });

    // Empty bar track
    const track = document.createElementNS(svgNS, 'rect');
    track.setAttribute('x', x); track.setAttribute('y', padT);
    track.setAttribute('width', barW); track.setAttribute('height', chartH);
    track.setAttribute('rx', '6');
    track.setAttribute('fill', 'var(--color-chart-empty)');
    svgEl.appendChild(track);

    // Filled bar
    if (barH > 0) {
      const bar = document.createElementNS(svgNS, 'rect');
      bar.setAttribute('class', 'weekly-bar-rect');
      bar.setAttribute('x', x); bar.setAttribute('y', y);
      bar.setAttribute('width', barW); bar.setAttribute('height', barH);
      bar.setAttribute('rx', '6');
      bar.setAttribute('fill', pct === 1 ? 'var(--color-accent)' : 'var(--color-chart-fill)');
      bar.setAttribute('opacity', isToday ? '1' : '0.85');
      svgEl.appendChild(bar);
    }

    // Percentage label above bar
    if (pct > 0) {
      const pctLabel = document.createElementNS(svgNS, 'text');
      pctLabel.setAttribute('x', x + barW / 2);
      pctLabel.setAttribute('y', Math.max(padT + 14, y - 4));
      pctLabel.setAttribute('text-anchor', 'middle');
      pctLabel.setAttribute('font-size', '10');
      pctLabel.setAttribute('font-family', 'var(--font-mono)');
      pctLabel.setAttribute('fill', 'var(--color-text-secondary)');
      pctLabel.textContent = Math.round(pct * 100) + '%';
      svgEl.appendChild(pctLabel);
    }

    // Day label below bar
    const d = parseLocalDate(day.date);
    const dayName = d.toLocaleDateString([], { weekday: 'short' });
    const dayLabel = document.createElementNS(svgNS, 'text');
    dayLabel.setAttribute('x', x + barW / 2);
    dayLabel.setAttribute('y', padT + chartH + 18);
    dayLabel.setAttribute('text-anchor', 'middle');
    dayLabel.setAttribute('font-size', '11');
    dayLabel.setAttribute('font-family', 'var(--font-sans)');
    dayLabel.setAttribute('font-weight', isToday ? '700' : '400');
    dayLabel.setAttribute('fill', isToday ? 'var(--color-primary)' : 'var(--color-text-secondary)');
    dayLabel.textContent = dayName;
    svgEl.appendChild(dayLabel);

    // Accessible table row
    if (tableBody) {
      const tr = document.createElement('tr');
      const tdDay  = document.createElement('td');
      const tdPct  = document.createElement('td');
      tdDay.textContent = day.date + (isToday ? ' (today)' : '');
      tdPct.textContent = day.total ? `${Math.round(pct * 100)}% (${day.completed}/${day.total})` : 'No data';
      tr.appendChild(tdDay); tr.appendChild(tdPct);
      tableBody.appendChild(tr);
    }
  });

  // 7-day trend polyline
  if (trendPoints.length > 1) {
    const pointsAttr = trendPoints.map(p => `${p.x},${p.y}`).join(' ');
    const polyline = document.createElementNS(svgNS, 'polyline');
    polyline.setAttribute('class', 'weekly-trend-line');
    polyline.setAttribute('points', pointsAttr);
    svgEl.appendChild(polyline);

    trendPoints.forEach(p => {
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', p.x);
      circle.setAttribute('cy', p.y);
      circle.setAttribute('r', '3.5');
      circle.setAttribute('fill', p.pct === 1 ? 'var(--color-accent)' : 'var(--color-secondary)');
      circle.setAttribute('stroke', '#06080c');
      circle.setAttribute('stroke-width', '1.5');
      svgEl.appendChild(circle);
    });
  }

  // Weekly stats
  const statsGrid = document.getElementById('weekly-stats-grid');
  if (statsGrid) {
    statsGrid.innerHTML = '';

    const totalWorkouts = week.filter(d => d.completed > 0).length;
    const totalEx = week.reduce((s, d) => s + d.completed, 0);
    const avgPct  = week.filter(d => d.total > 0).length
      ? Math.round(week.filter(d => d.total > 0).reduce((s, d) => s + d.completed / d.total, 0) / week.filter(d => d.total > 0).length * 100)
      : 0;

    const streak = calculateStreak(week, s.history);

    const histMap = new Map();
    if (Array.isArray(s.history)) {
      s.history.forEach(h => { if (h && h.date) histMap.set(h.date, h); });
    }
    let totalWater7 = 0;
    week.forEach(d => {
      if (d.date === todayKey()) {
        totalWater7 += s.today.water.reduce((sum, e) => sum + e.ml, 0);
      } else {
        const h = histMap.get(d.date);
        if (h && typeof h.water === 'number') totalWater7 += h.water;
      }
    });
    const avgWater = Math.round(totalWater7 / 7);

    [
      { label: 'Active days',       value: totalWorkouts + ' / 7' },
      { label: 'Total exercises',   value: totalEx },
      { label: 'Avg completion',    value: avgPct + '%' },
      { label: 'Current streak',    value: streak + (streak === 1 ? ' day' : ' days') },
      { label: 'Avg hydration',     value: avgWater + ' ml' },
    ].forEach(stat => {
      const item = document.createElement('div');
      item.className = 'weekly-stat-item';
      item.setAttribute('role', 'listitem');

      const v = document.createElement('div');
      v.className = 'weekly-stat-value';
      v.textContent = stat.value;

      const l = document.createElement('div');
      l.className = 'weekly-stat-label';
      l.textContent = stat.label;

      item.appendChild(v);
      item.appendChild(l);
      statsGrid.appendChild(item);
    });
  }

  // Activity History List
  const historyList = document.getElementById('workout-history-list');
  if (historyList) {
    historyList.innerHTML = '';
    const histMap = new Map();
    if (Array.isArray(s.history)) {
      s.history.forEach(h => { if (h && h.date) histMap.set(h.date, h); });
    }

    [...week].reverse().forEach(day => {
      const isToday = day.date === todayKey();
      const h = histMap.get(day.date);
      const routineName = isToday
        ? (s.routines.find(r => r.id === s.today.routineId)?.name || 'Rest Day')
        : (h?.routineName || (day.completed > 0 ? 'Workout' : 'Rest Day'));
      const waterLogged = isToday
        ? s.today.water.reduce((sum, e) => sum + e.ml, 0)
        : (h?.water || 0);

      const item = document.createElement('div');
      item.className = 'workout-history-item';
      item.setAttribute('role', 'listitem');

      const main = document.createElement('div');
      main.className = 'workout-history-main';

      const dName = document.createElement('div');
      dName.className = 'workout-history-date';
      dName.textContent = formatDate(day.date) + (isToday ? ' (Today)' : '');

      const rName = document.createElement('div');
      rName.className = 'workout-history-routine';
      rName.textContent = routineName;

      main.appendChild(dName);
      main.appendChild(rName);

      const stats = document.createElement('div');
      stats.className = 'workout-history-stats';

      const exStat = document.createElement('span');
      exStat.textContent = `${day.completed}/${day.total} ex`;

      const watStat = document.createElement('span');
      watStat.textContent = `${waterLogged} ml`;

      const badge = document.createElement('span');
      badge.className = 'workout-history-badge';
      if (day.total > 0 && day.completed >= day.total) {
        badge.classList.add('completed');
        badge.textContent = 'Completed';
      } else if (day.completed > 0) {
        badge.classList.add('partial');
        badge.textContent = 'Partial';
      } else {
        badge.classList.add('rest');
        badge.textContent = 'Rest Day';
      }

      stats.appendChild(exStat);
      stats.appendChild(watStat);
      stats.appendChild(badge);

      item.appendChild(main);
      item.appendChild(stats);
      historyList.appendChild(item);
    });
  }

  // Render monthly heatmap & biomechanical distribution charts
  renderMonthlyHeatmap(s);
  renderMuscleAnalytics(s);
}

/* ── 28-DAY MONTHLY HEATMAP RENDER ───────────────────────────*/
function renderMonthlyHeatmap(s) {
  const container = document.getElementById('monthly-activity-heatmap');
  const tooltip = document.getElementById('heatmap-tooltip');
  if (!container) return;

  container.innerHTML = '';

  // Prepare map of historical data
  const dataMap = new Map();
  if (Array.isArray(s.history)) {
    s.history.forEach(h => {
      if (h && h.date) dataMap.set(h.date, { ...h });
    });
  }
  if (Array.isArray(s.weekly)) {
    s.weekly.forEach(w => {
      if (w && w.date) {
        const existing = dataMap.get(w.date) || {};
        dataMap.set(w.date, {
          ...existing,
          date: w.date,
          completed: w.completed,
          total: w.total
        });
      }
    });
  }
  // Include today's live state
  const tKey = todayKey();
  const todayRoutine = s.routines ? s.routines.find(r => r.id === s.today.routineId) : null;
  dataMap.set(tKey, {
    date: tKey,
    completed: (s.today && Array.isArray(s.today.completed)) ? s.today.completed.length : 0,
    total: todayRoutine ? todayRoutine.exercises.length : 0,
    water: (s.today && Array.isArray(s.today.water)) ? s.today.water.reduce((acc, e) => acc + e.ml, 0) : 0
  });

  // Generate 28 rolling calendar days ending at today
  const days = [];
  const today = parseLocalDate(tKey);
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push(toLocalDateKey(d));
  }

  days.forEach(dateKey => {
    const info = dataMap.get(dateKey) || { completed: 0, total: 0, water: 0 };
    const completed = info.completed || 0;
    const total = info.total || 0;
    const isToday = dateKey === tKey;

    let level = '0';
    if (total > 0 && completed >= total) {
      level = '2';
    } else if (completed > 0) {
      level = '1';
    }

    const cell = document.createElement('div');
    cell.className = `heatmap-cell level-${level}` + (isToday ? ' today-cell' : '');
    cell.setAttribute('tabindex', '0');
    cell.setAttribute('role', 'gridcell');

    const dObj = parseLocalDate(dateKey);
    const dayNum = dObj.getDate();
    cell.textContent = dayNum;

    const accessibleLabel = `${formatDate(dateKey)}: ${completed} of ${total} exercises completed${info.water ? `, ${info.water} ml hydration` : ''}`;
    cell.setAttribute('aria-label', accessibleLabel);

    // Hover tooltip handlers
    if (tooltip) {
      const showTip = () => {
        tooltip.innerHTML = `<strong>${formatDate(dateKey)}${isToday ? ' (Today)' : ''}</strong><br/>Exercises: ${completed}/${total}<br/>Hydration: ${info.water || 0} ml`;
        tooltip.hidden = false;
        const rect = cell.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();
        tooltip.style.left = `${rect.left - parentRect.left + (rect.width / 2) - 60}px`;
        tooltip.style.top = `${rect.top - parentRect.top - 58}px`;
      };
      const hideTip = () => {
        tooltip.hidden = true;
      };

      cell.addEventListener('mouseenter', showTip);
      cell.addEventListener('mouseleave', hideTip);
      cell.addEventListener('focus', showTip);
      cell.addEventListener('blur', hideTip);
    }

    container.appendChild(cell);
  });
}

/* ── BIOMECHANICAL & MUSCLE ANALYTICS RENDER ─────────────────*/
function renderMuscleAnalytics(s) {
  const donutSvg = document.getElementById('chart-muscle-donut');
  const donutLegend = document.getElementById('donut-legend');
  const radarSvg = document.getElementById('chart-muscle-radar');
  const totalCountEl = document.getElementById('donut-total-exercises');
  const balanceScoreEl = document.getElementById('radar-balance-score');

  if (!donutSvg && !radarSvg) return;

  const categories = [
    { key: 'chest',     label: 'Chest',     color: '#c6ff00' },
    { key: 'back',      label: 'Back',      color: '#00e5ff' },
    { key: 'legs',      label: 'Legs',      color: '#ff9100' },
    { key: 'shoulders', label: 'Shoulders', color: '#b388ff' },
    { key: 'arms',      label: 'Arms',      color: '#ff4081' },
    { key: 'cardio',    label: 'Cardio',    color: '#00e676' },
  ];

  const counts = { chest: 0, back: 0, legs: 0, shoulders: 0, arms: 0, cardio: 0 };
  let totalExercises = 0;

  (s.routines || []).forEach(r => {
    const cat = (r.category || '').toLowerCase();
    const count = Array.isArray(r.exercises) ? r.exercises.length : 0;
    if (counts[cat] !== undefined) {
      counts[cat] += count;
    } else {
      counts.cardio += count;
    }
    totalExercises += count;
  });

  if (totalCountEl) {
    totalCountEl.textContent = totalExercises;
  }

  const svgNS = 'http://www.w3.org/2000/svg';

  // 1. DONUT CHART
  if (donutSvg) {
    donutSvg.innerHTML = '<title>Muscle Group Distribution</title>';
    const cx = 100, cy = 100, r = 68;
    const circumference = 2 * Math.PI * r;

    // Track circle
    const track = document.createElementNS(svgNS, 'circle');
    track.setAttribute('cx', cx);
    track.setAttribute('cy', cy);
    track.setAttribute('r', r);
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', 'rgba(255, 255, 255, 0.05)');
    track.setAttribute('stroke-width', '20');
    donutSvg.appendChild(track);

    if (totalExercises > 0) {
      let accumulatedOffset = 0;
      categories.forEach(cat => {
        const count = counts[cat.key];
        if (count === 0) return;

        const fraction = count / totalExercises;
        const segmentLength = fraction * circumference;
        const dashArray = `${segmentLength.toFixed(2)} ${(circumference - segmentLength).toFixed(2)}`;

        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('class', 'donut-segment');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', r);
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', cat.color);
        circle.setAttribute('stroke-width', '20');
        circle.setAttribute('stroke-dasharray', dashArray);
        circle.setAttribute('stroke-dashoffset', (-accumulatedOffset).toFixed(2));

        const title = document.createElementNS(svgNS, 'title');
        title.textContent = `${cat.label}: ${count} exercises (${Math.round(fraction * 100)}%)`;
        circle.appendChild(title);

        donutSvg.appendChild(circle);
        accumulatedOffset += segmentLength;
      });
    }

    // Donut Legend
    if (donutLegend) {
      donutLegend.innerHTML = '';
      categories.forEach(cat => {
        const count = counts[cat.key];
        const pct = totalExercises > 0 ? Math.round((count / totalExercises) * 100) : 0;

        const item = document.createElement('div');
        item.className = 'donut-legend-item';
        item.setAttribute('role', 'listitem');

        const dot = document.createElement('span');
        dot.className = 'legend-dot';
        dot.style.background = cat.color;

        const text = document.createElement('span');
        text.textContent = `${cat.label}: ${count} (${pct}%)`;

        item.appendChild(dot);
        item.appendChild(text);
        donutLegend.appendChild(item);
      });
    }
  }

  // 2. RADAR CHART
  if (radarSvg) {
    radarSvg.innerHTML = '<title>Performance Symmetry Radar</title>';
    const cx = 120, cy = 110, maxR = 70;
    const numAxes = categories.length;
    const angleStep = (2 * Math.PI) / numAxes;

    // Hexagonal Concentric Web Grids (25%, 50%, 75%, 100%)
    [0.25, 0.5, 0.75, 1.0].forEach(level => {
      const gridR = maxR * level;
      const pts = [];
      for (let i = 0; i < numAxes; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const x = cx + gridR * Math.cos(angle);
        const y = cy + gridR * Math.sin(angle);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      const poly = document.createElementNS(svgNS, 'polygon');
      poly.setAttribute('class', 'radar-web');
      poly.setAttribute('points', pts.join(' '));
      radarSvg.appendChild(poly);
    });

    // Axis Spokes & Labels
    categories.forEach((cat, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const xEnd = cx + maxR * Math.cos(angle);
      const yEnd = cy + maxR * Math.sin(angle);

      // Spoke
      const spoke = document.createElementNS(svgNS, 'line');
      spoke.setAttribute('class', 'radar-spoke');
      spoke.setAttribute('x1', cx);
      spoke.setAttribute('y1', cy);
      spoke.setAttribute('x2', xEnd.toFixed(1));
      spoke.setAttribute('y2', yEnd.toFixed(1));
      radarSvg.appendChild(spoke);

      // Label outside grid
      const labelR = maxR + 18;
      const xLabel = cx + labelR * Math.cos(angle);
      const yLabel = cy + labelR * Math.sin(angle);

      const label = document.createElementNS(svgNS, 'text');
      label.setAttribute('class', 'radar-label');
      label.setAttribute('x', xLabel.toFixed(1));
      label.setAttribute('y', yLabel.toFixed(1));
      label.textContent = cat.key.toUpperCase();
      radarSvg.appendChild(label);
    });

    // Data polygon
    const maxVal = Math.max(...Object.values(counts), 1);
    const dataPts = [];

    categories.forEach((cat, i) => {
      const val = counts[cat.key];
      const ratio = totalExercises > 0 ? (val / maxVal) : 0.05;
      const r = Math.max(maxR * ratio, 6);
      const angle = i * angleStep - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      dataPts.push({ x, y, val, label: cat.label });
    });

    const pointsAttr = dataPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const dataPolygon = document.createElementNS(svgNS, 'polygon');
    dataPolygon.setAttribute('class', 'radar-polygon');
    dataPolygon.setAttribute('points', pointsAttr);
    radarSvg.appendChild(dataPolygon);

    // Data vertices
    dataPts.forEach(p => {
      const v = document.createElementNS(svgNS, 'circle');
      v.setAttribute('class', 'radar-vertex');
      v.setAttribute('cx', p.x.toFixed(1));
      v.setAttribute('cy', p.y.toFixed(1));
      v.setAttribute('r', '3.5');
      const title = document.createElementNS(svgNS, 'title');
      title.textContent = `${p.label}: ${p.val}`;
      v.appendChild(title);
      radarSvg.appendChild(v);
    });

    // Symmetry Score Calculation
    if (balanceScoreEl) {
      const activeCount = categories.filter(c => counts[c.key] > 0).length;
      if (totalExercises === 0) {
        balanceScoreEl.textContent = 'NO ROUTINES';
        balanceScoreEl.style.color = 'var(--color-text-dim)';
      } else if (activeCount >= 5) {
        balanceScoreEl.textContent = 'OPTIMAL (BALANCED)';
        balanceScoreEl.style.color = 'var(--color-primary)';
      } else if (activeCount >= 3) {
        balanceScoreEl.textContent = 'MODERATE DISTRIBUTION';
        balanceScoreEl.style.color = 'var(--color-secondary)';
      } else {
        balanceScoreEl.textContent = 'SPECIALIZED FOCUS';
        balanceScoreEl.style.color = 'var(--color-warning)';
      }
    }
  }
}

/* ── GOALS RENDER ────────────────────────────────────────────*/
function renderGoals() {
  const s = State.get();

  // Populate form values (don't overwrite if actively editing)
  ['goal-workouts', 'goal-exercises', 'goal-water'].forEach((id, i) => {
    const input = document.getElementById(id);
    if (input && input !== document.activeElement) {
      input.value = [s.goals.workouts, s.goals.exercises, s.goals.water][i];
    }
  });

  // Progress items
  const listEl = document.getElementById('goals-progress-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const routine = s.routines.find(r => r.id === s.today.routineId);
  const exTotal  = routine ? routine.exercises.length : 0;
  const exDone   = s.today.completed.length;
  const waterMl  = s.today.water.reduce((sum, e) => sum + e.ml, 0);

  [
    { label: 'Exercises completed', current: exDone,  goal: s.goals.exercises, unit: 'exercises' },
    { label: 'Water intake',        current: waterMl, goal: s.goals.water,     unit: 'ml' },
  ].forEach(item => {
    const pct = Math.round(clamp(item.current / Math.max(1, item.goal), 0, 1) * 100);
    const wrapper = document.createElement('div');
    wrapper.className = 'goal-progress-item';

    const labelRow = document.createElement('div');
    labelRow.className = 'goal-progress-label';

    const nameEl = document.createElement('span');
    nameEl.className = 'goal-progress-name';
    nameEl.textContent = item.label;

    const fracEl = document.createElement('span');
    fracEl.className = 'goal-progress-fraction';
    fracEl.textContent = `${item.current} / ${item.goal} ${item.unit} (${pct}%)`;

    labelRow.appendChild(nameEl);
    labelRow.appendChild(fracEl);

    const track = document.createElement('div');
    track.className = 'progress-bar-track';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('div');
    fill.className = 'progress-bar-fill' + (pct >= 100 ? ' complete' : '');
    fill.style.width = pct + '%';
    track.appendChild(fill);

    wrapper.appendChild(labelRow);
    wrapper.appendChild(track);
    listEl.appendChild(wrapper);
  });
}

function validateGoalField(inputId, errorId, min, max, label) {
  const input = document.getElementById(inputId);
  const val   = parseInt(input.value, 10);
  if (isNaN(val) || val < min || val > max) {
    showError(errorId, `${label} must be between ${min} and ${max}.`);
    markInvalid(input, true);
    return null;
  }
  clearError(errorId);
  markInvalid(input, false);
  return val;
}

function initGoals() {
  document.getElementById('goals-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const workouts  = validateGoalField('goal-workouts',  'goal-workouts-error',  1,   10,     'Workouts per day');
    const exercises = validateGoalField('goal-exercises', 'goal-exercises-error', 1,   100,    'Exercises per day');
    const water     = validateGoalField('goal-water',     'goal-water-error',     100, 10000,  'Water intake');

    if (workouts == null || exercises == null || water == null) return;

    const saved = State.set(d => { d.goals = { workouts, exercises, water }; });
    renderGoals();
    renderDashboard();
    renderWater();

    // Success feedback only if storage save succeeded
    const success = document.getElementById('goals-success');
    if (success && saved) {
      success.hidden = false;
      setTimeout(() => { success.hidden = true; }, 2500);
    }
  });
}

/* ── RESET MODAL ─────────────────────────────────────────────*/
function closeResetModal() {
  const modal = document.getElementById('modal-reset');
  if (modal) modal.hidden = true;
}

function initReset() {
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    document.getElementById('modal-reset').hidden = false;
    document.getElementById('btn-cancel-reset').focus();
  });

  document.getElementById('modal-close-reset')?.addEventListener('click', closeResetModal);
  document.getElementById('btn-cancel-reset')?.addEventListener('click', closeResetModal);

  document.getElementById('modal-reset')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeResetModal();
  });

  document.getElementById('btn-confirm-reset')?.addEventListener('click', () => {
    Storage.clear();
    State._data = makeSampleData();
    Storage.save(State._data);
    closeResetModal();
    navigate('dashboard');
  });
}

/* ── DATA MANAGEMENT (EXPORT / IMPORT) ───────────────────────*/
function exportBackupData() {
  const s = State.get();
  const exportPayload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    routines: s.routines,
    goals: s.goals,
    today: s.today,
    weekly: s.weekly,
    history: s.history || []
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gymflow-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showDataFeedback('Backup file exported successfully!', 'success');
}

function validateImportData(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { valid: false, error: 'File is not a valid JSON object.' };
  }
  if (!Array.isArray(data.routines) || data.routines.length === 0) {
    return { valid: false, error: 'Backup must contain at least one valid routine in "routines".' };
  }
  for (let i = 0; i < data.routines.length; i++) {
    const r = data.routines[i];
    if (!r || typeof r.name !== 'string' || !r.name.trim()) {
      return { valid: false, error: `Routine #${i + 1} is missing a valid name.` };
    }
    if (!Array.isArray(r.exercises)) {
      return { valid: false, error: `Routine "${r.name}" is missing an exercises array.` };
    }
  }
  if (!data.goals || typeof data.goals !== 'object') {
    return { valid: false, error: 'Backup is missing required "goals" configuration.' };
  }
  const g = data.goals;
  if (typeof g.workouts !== 'number' || g.workouts < 1 ||
      typeof g.exercises !== 'number' || g.exercises < 1 ||
      typeof g.water !== 'number' || g.water < 100) {
    return { valid: false, error: 'Invalid goal values in backup file.' };
  }

  // Sanitized structure
  const today = todayKey();
  const sanitized = {
    _isSampleData: false,
    routines: data.routines.map(r => ({
      id: r.id || uid(),
      name: String(r.name).trim().slice(0, 60),
      category: ['chest', 'back', 'legs', 'shoulders', 'arms', 'cardio'].includes(r.category) ? r.category : 'chest',
      exercises: r.exercises.map(e => ({
        id: e.id || uid(),
        name: String(e.name).trim().slice(0, 60),
        sets: Math.max(0, parseInt(e.sets, 10) || 0),
        reps: Math.max(0, parseInt(e.reps, 10) || 0),
        duration: Math.max(0, parseInt(e.duration, 10) || 0),
        rest: Math.max(0, parseInt(e.rest, 10) || 0)
      }))
    })),
    goals: {
      workouts: Math.min(10, Math.max(1, parseInt(g.workouts, 10) || 1)),
      exercises: Math.min(100, Math.max(1, parseInt(g.exercises, 10) || 8)),
      water: Math.min(10000, Math.max(100, parseInt(g.water, 10) || 2000))
    },
    today: {
      date: today,
      routineId: data.today && data.routines.some(r => r.id === data.today.routineId)
        ? data.today.routineId
        : data.routines[0].id,
      completed: (data.today && data.today.date === today && Array.isArray(data.today.completed))
        ? data.today.completed
        : [],
      water: (data.today && data.today.date === today && Array.isArray(data.today.water))
        ? data.today.water
        : []
    },
    weekly: Array.isArray(data.weekly) ? data.weekly : buildEmptyWeek(),
    history: Array.isArray(data.history) ? data.history : []
  };

  return { valid: true, sanitized };
}

function showDataFeedback(msg, type = 'success') {
  const el = document.getElementById('data-feedback-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = `field-feedback ${type}`;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 5000);
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const validation = validateImportData(parsed);
      if (!validation.valid) {
        showDataFeedback(`Import error: ${validation.error}`, 'error');
        return;
      }

      State.set(d => {
        Object.assign(d, validation.sanitized);
        ensureWeeklyRolling(d);
        syncTodayWeekly(d);
      });

      showDataFeedback(`Successfully imported ${validation.sanitized.routines.length} routines and personal data!`, 'success');
      navigate('dashboard');
    } catch (err) {
      showDataFeedback('Could not parse file as JSON. Please upload a valid GymFlow backup file.', 'error');
    }
  };
  reader.readAsText(file);
}

function initDataManagement() {
  const triggerExport = () => exportBackupData();
  document.getElementById('btn-export-data')?.addEventListener('click', triggerExport);
  document.getElementById('btn-export-data-goals')?.addEventListener('click', triggerExport);

  const fileInput = document.getElementById('file-import-data');
  const triggerImport = () => {
    if (fileInput) {
      fileInput.value = '';
      fileInput.click();
    }
  };

  document.getElementById('btn-import-data')?.addEventListener('click', triggerImport);
  document.getElementById('btn-import-data-goals')?.addEventListener('click', triggerImport);

  fileInput?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) handleImportFile(file);
  });
}

/* ── FOCUS TRAP (modals) ─────────────────────────────────────*/
function trapFocus(modal) {
  const focusable = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];

  modal.addEventListener('keydown', function handler(e) {
    if (e.key !== 'Tab') return;
    if (modal.hidden) { modal.removeEventListener('keydown', handler); return; }
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  });
}

/* ── MILESTONE BANNER ────────────────────────────────────────*/
function initMilestoneBanner() {
  const btn = document.getElementById('btn-milestone-close');
  const banner = document.getElementById('milestone-banner');
  if (!btn || !banner) return;
  btn.addEventListener('click', () => {
    banner.hidden = true;
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem('gymflow_milestone_dismissed_' + todayKey(), '1');
      } catch (e) {
        // ignore storage errors
      }
    }
  });
}

/* ── INIT ────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {
  State.init();
  initRouter();
  initRoutineModal();
  initDeleteRoutineModal();
  initRoutinesFilter();
  initWater();
  initGoals();
  initReset();
  initDataManagement();
  initMilestoneBanner();

  // Set up focus traps for all modals
  ['modal-routine', 'modal-reset', 'modal-delete-routine'].forEach(id => {
    const m = document.getElementById(id);
    if (m) trapFocus(m);
  });
});

if (typeof window !== 'undefined') {
  window.__app = {
    Storage, State, toLocalDateKey, todayKey, parseLocalDate, formatDate,
    buildEmptyWeek, syncTodayWeekly, ensureWeeklyRolling, archiveDayToHistory,
    calculateStreak, validateImportData, exportBackupData, handleImportFile,
    formatExerciseMeta, formatExerciseCompact, makeSampleData,
    animateNumber, renderMonthlyHeatmap, renderMuscleAnalytics
  };
}
