// GymFlow Prototype A: Spatial Performance Interactive Controller

document.addEventListener('DOMContentLoaded', () => {
  // State
  let completedExercises = new Set(['e1', 'e2']);
  let waterAmount = 1750;
  const waterGoal = 3000;
  let activeFilter = 'all';

  // DOM Elements
  const exerciseCards = document.querySelectorAll('.spatial-card');
  const filterChips = document.querySelectorAll('.filter-chip');
  const routineSelector = document.getElementById('routine-selector');
  const activeRoutineName = document.getElementById('active-routine-name');
  const activeRoutineCat = document.getElementById('active-routine-cat');
  const radialBar = document.getElementById('radial-progress-bar');
  const radialText = document.getElementById('radial-progress-text');
  const completedCountLabel = document.getElementById('completed-count-label');
  const hudCompletion = document.getElementById('hud-completion');
  const chartTodayBar = document.getElementById('chart-today-bar');

  // Hydration DOM
  const waterCurrentDisplay = document.getElementById('water-current-display');
  const waterGaugeFill = document.getElementById('water-gauge-fill');
  const waterPctBadge = document.getElementById('water-pct-badge');
  const hudWaterPill = document.getElementById('hud-water-pill');
  const waterButtons = document.querySelectorAll('.water-btn');

  function updateExerciseProgress() {
    const total = exerciseCards.length;
    const completed = completedExercises.size;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    // Radial Progress: circumference = 2 * PI * 32 ~= 201
    const circumference = 201;
    const offset = circumference - (pct / 100) * circumference;
    if (radialBar) radialBar.style.strokeDashoffset = offset;
    if (radialText) radialText.textContent = `${completed}/${total}`;
    if (completedCountLabel) completedCountLabel.textContent = `${completed} of ${total} Complete`;
    if (hudCompletion) hudCompletion.textContent = `${pct}%`;
    if (chartTodayBar) chartTodayBar.style.height = `${Math.max(10, pct)}%`;
  }

  function updateHydration() {
    const pct = Math.min(100, Math.round((waterAmount / waterGoal) * 100));
    if (waterCurrentDisplay) waterCurrentDisplay.textContent = waterAmount.toLocaleString();
    if (waterGaugeFill) waterGaugeFill.style.width = `${pct}%`;
    if (waterPctBadge) waterPctBadge.textContent = `${pct}%`;
    if (hudWaterPill) hudWaterPill.textContent = `${waterAmount.toLocaleString()} / ${waterGoal.toLocaleString()} ML`;
  }

  // Toggle Exercise Completion
  exerciseCards.forEach(card => {
    const id = card.dataset.id;
    const ring = card.querySelector('.action-check-ring');
    const statusText = card.querySelector('.spatial-status-text');
    const metricDot = card.querySelector('.spatial-metric-dot');

    function toggle() {
      if (completedExercises.has(id)) {
        completedExercises.delete(id);
        card.classList.remove('completed');
        if (ring) ring.classList.remove('checked');
        if (statusText) statusText.textContent = 'STATUS: PENDING';
        if (metricDot) metricDot.classList.add('dim');
      } else {
        completedExercises.add(id);
        card.classList.add('completed');
        if (ring) ring.classList.add('checked');
        if (statusText) statusText.textContent = 'STATUS: RECORDED';
        if (metricDot) metricDot.classList.remove('dim');
      }
      updateExerciseProgress();
    }

    if (ring) {
      ring.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
      });
    }

    card.addEventListener('click', () => {
      toggle();
    });
  });

  // Filter Chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;

      exerciseCards.forEach(card => {
        const cat = card.dataset.cat;
        if (activeFilter === 'all' || cat === activeFilter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Water Increment Buttons
  waterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const add = parseInt(btn.dataset.add, 10);
      waterAmount += add;
      updateHydration();
    });
  });

  // Routine Selector
  if (routineSelector) {
    routineSelector.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'r1') {
        activeRoutineName.textContent = 'Push Power Hypertrophy';
        activeRoutineCat.textContent = 'CHEST / TRICEPS / DELTS';
      } else if (val === 'r2') {
        activeRoutineName.textContent = 'Pull Strength Protocol';
        activeRoutineCat.textContent = 'BACK / BICEPS / REAR DELTS';
      } else if (val === 'r3') {
        activeRoutineName.textContent = 'Legs & Core Conditioning';
        activeRoutineCat.textContent = 'QUADS / HAMSTRINGS / ABS';
      }
      // Reset state for new routine per protocol
      completedExercises.clear();
      exerciseCards.forEach(card => {
        card.classList.remove('completed');
        const ring = card.querySelector('.action-check-ring');
        const statusText = card.querySelector('.spatial-status-text');
        const metricDot = card.querySelector('.spatial-metric-dot');
        if (ring) ring.classList.remove('checked');
        if (statusText) statusText.textContent = 'STATUS: PENDING';
        if (metricDot) metricDot.classList.add('dim');
      });
      updateExerciseProgress();
    });
  }

  // Initial render
  updateExerciseProgress();
  updateHydration();
});

