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
    } catch (e) {
      // quota exceeded or private-mode restriction
      console.warn('GymFlow: could not save state', e);
    }
  },

  clear() {
    try { localStorage.removeItem(this.KEY); } catch { /* ignore */ }
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
    // Migrate today's date if stale
    if (this._data.today.date !== todayKey()) {
      this._data.today = { date: todayKey(), routineId: null, completed: [], water: [] };
      this._persist();
    }
  },

  get() { return this._data; },

  set(updater) {
    updater(this._data);
    this._persist();
    this._notify();
  },

  subscribe(fn) { this._subs.push(fn); },

  _persist() { Storage.save(this._data); },

  _notify() { this._subs.forEach(fn => fn(this._data)); }
};

/* ── UTILITIES ───────────────────────────────────────────────*/
function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function buildEmptyWeek() {
  // Rolling 7 days: each day stores { date, completed, total }
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().slice(0, 10), completed: 0, total: 0 });
  }
  return days;
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric'
  });
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
    if (section) section.hidden = v !== view;
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
  const routine = s.routines.find(r => r.id === s.today.routineId) || s.routines[0] || null;

  if (routine) {
    // Link today's routineId if not set
    if (!s.today.routineId) {
      State.set(d => { d.today.routineId = routine.id; });
    }
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
        // Update weekly data for today
        const w = d.weekly.find(day => day.date === todayKey());
        if (w) { w.total = routine.exercises.length; w.completed = d.today.completed.length; }
      });
      renderDashboard();
    });

    const name = document.createElement('span');
    name.className = 'exercise-name';
    name.textContent = ex.name;

    const meta = document.createElement('span');
    meta.className = 'exercise-meta';
    if (ex.sets && ex.reps) meta.textContent = `${ex.sets}×${ex.reps}`;
    if (ex.rest)            meta.textContent += ` · ${ex.rest}s`;

    item.appendChild(checkbox);
    item.appendChild(name);
    item.appendChild(meta);
    listEl.appendChild(item);
  });
}

/* ── ROUTINES RENDER ─────────────────────────────────────────*/
function renderRoutines() {
  const s = State.get();
  const listEl  = document.getElementById('routines-list');
  const emptyEl = document.getElementById('routines-empty');
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = '';

  if (s.routines.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  s.routines.forEach(routine => {
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
        d.today.routineId = routine.id;
        d.today.completed = [];
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
    btnDelete.addEventListener('click', () => {
      // shortcut: window.confirm for delete; replace with a custom modal if embedding in an iframe
      if (!confirm(`Delete "${routine.name}"? This cannot be undone.`)) return;
      State.set(d => {
        d.routines = d.routines.filter(r => r.id !== routine.id);
        if (d.today.routineId === routine.id) {
          d.today.routineId = d.routines[0]?.id || null;
          d.today.completed = [];
        }
        d._isSampleData = false;
      });
      renderRoutines();
      renderDashboard();
    });

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
      let metaText = '';
      if (ex.sets) metaText += ex.sets + ' sets';
      if (ex.reps) metaText += ' × ' + ex.reps + ' reps';
      if (ex.rest) metaText += ' · ' + ex.rest + 's rest';
      exMeta.textContent = metaText;

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
  const repsGroup = makeNumField('Reps', '10', ex.reps, 1, 200, 'Reps per set');
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
    const rest = parseInt(inputs[3].value, 10) || 0;
    exercises.push({ id: uid(), name, sets, reps, rest });
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
      if (!document.getElementById('modal-routine').hidden) closeRoutineModal();
      if (!document.getElementById('modal-reset').hidden)   closeResetModal();
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
          // Reset completion if editing today's routine
          if (d.today.routineId === _editingRoutineId) d.today.completed = [];
        }
      } else {
        const newRoutine = { id: uid(), name, category, exercises };
        d.routines.push(newRoutine);
        // Auto-set as today if no routine is set
        if (!d.today.routineId) d.today.routineId = newRoutine.id;
      }
    });

    closeRoutineModal();
    renderRoutines();
    renderDashboard();
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

/* ── WEEKLY RENDER ───────────────────────────────────────────*/
function renderWeekly() {
  const s = State.get();

  // Ensure weekly array covers the last 7 days
  const week = buildEmptyWeek();
  week.forEach(day => {
    const existing = s.weekly.find(w => w.date === day.date);
    if (existing) { day.completed = existing.completed; day.total = existing.total; }
    // Patch today from live state
    if (day.date === todayKey()) {
      const routine = s.routines.find(r => r.id === s.today.routineId);
      day.total = routine ? routine.exercises.length : 0;
      day.completed = s.today.completed.length;
    }
  });

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

  week.forEach((day, i) => {
    const pct = day.total ? clamp(day.completed / day.total, 0, 1) : 0;
    const barH = Math.max(pct > 0 ? 4 : 0, Math.round(pct * chartH));
    const x    = padL + i * barGap + (barGap - barW) / 2;
    const y    = padT + chartH - barH;
    const isToday = day.date === todayKey();

    // Empty bar track
    const track = document.createElementNS(svgNS, 'rect');
    track.setAttribute('x', x); track.setAttribute('y', padT);
    track.setAttribute('width', barW); track.setAttribute('height', chartH);
    track.setAttribute('rx', '4');
    track.setAttribute('fill', 'var(--color-chart-empty)');
    svgEl.appendChild(track);

    // Filled bar
    if (barH > 0) {
      const bar = document.createElementNS(svgNS, 'rect');
      bar.setAttribute('x', x); bar.setAttribute('y', y);
      bar.setAttribute('width', barW); bar.setAttribute('height', barH);
      bar.setAttribute('rx', '4');
      bar.setAttribute('fill', pct === 1 ? 'var(--color-accent)' : 'var(--color-chart-fill)');
      bar.setAttribute('opacity', isToday ? '1' : '0.75');
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
    const d = new Date(day.date + 'T12:00:00');
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

  // Weekly stats
  const statsGrid = document.getElementById('weekly-stats-grid');
  if (!statsGrid) return;
  statsGrid.innerHTML = '';

  const totalWorkouts = week.filter(d => d.completed > 0).length;
  const totalEx = week.reduce((s, d) => s + d.completed, 0);
  const avgPct  = week.filter(d => d.total > 0).length
    ? Math.round(week.filter(d => d.total > 0).reduce((s, d) => s + d.completed / d.total, 0) / week.filter(d => d.total > 0).length * 100)
    : 0;

  [
    { label: 'Active days',       value: totalWorkouts + ' / 7' },
    { label: 'Total exercises',   value: totalEx },
    { label: 'Avg completion',    value: avgPct + '%' },
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

    State.set(d => { d.goals = { workouts, exercises, water }; });
    renderGoals();
    renderDashboard();
    renderWater();

    // Success feedback
    const success = document.getElementById('goals-success');
    if (success) {
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

/* ── INIT ────────────────────────────────────────────────────*/
document.addEventListener('DOMContentLoaded', () => {
  State.init();
  initRouter();
  initRoutineModal();
  initWater();
  initGoals();
  initReset();

  // Set up focus traps for both modals
  ['modal-routine', 'modal-reset'].forEach(id => {
    const m = document.getElementById(id);
    if (m) trapFocus(m);
  });
});
