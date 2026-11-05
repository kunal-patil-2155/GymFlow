// GymFlow Prototype C: Living Interface Controller

document.addEventListener('DOMContentLoaded', () => {
  let completed = new Set(['e1', 'e2']);
  let water = 1800;
  const waterGoal = 3000;
  let activeFilter = 'all';

  const cards = document.querySelectorAll('.living-card');
  const routinePills = document.querySelectorAll('.switch-pill');
  const filterChips = document.querySelectorAll('.living-filter-chip');
  const routineTitle = document.getElementById('c-routine-title');

  // SVG Concentric Rings
  const ringWorkout = document.getElementById('ring-workout');
  const ringWater = document.getElementById('ring-water');
  const centerPct = document.getElementById('c-total-pct');

  // Fluid Tank
  const fluidLevel = document.getElementById('c-fluid-level');
  const waterVal = document.getElementById('c-water-val');
  const waterPct = document.getElementById('c-water-pct');
  const sipBtns = document.querySelectorAll('.fluid-sip-btn');
  const todayStem = document.getElementById('c-today-stem');

  function updateConcentricMetrics() {
    const total = cards.length;
    const count = completed.size;
    const workoutPct = total === 0 ? 0 : Math.round((count / total) * 100);

    // Workout Ring: r=58, c=364
    const cWorkout = 364;
    const offsetWorkout = cWorkout - (workoutPct / 100) * cWorkout;
    if (ringWorkout) ringWorkout.style.strokeDashoffset = offsetWorkout;

    // Water Ring: r=46, c=289
    const waterP = Math.min(100, Math.round((water / waterGoal) * 100));
    const cWater = 289;
    const offsetWater = cWater - (waterP / 100) * cWater;
    if (ringWater) ringWater.style.strokeDashoffset = offsetWater;

    // Overall Flow Percentage
    const avgFlow = Math.round((workoutPct + waterP) / 2);
    if (centerPct) centerPct.textContent = `${avgFlow}%`;

    // Today Bar
    if (todayStem) todayStem.style.height = `${Math.max(15, workoutPct)}%`;
  }

  function updateFluidTank() {
    const pct = Math.min(100, Math.round((water / waterGoal) * 100));
    if (fluidLevel) fluidLevel.style.height = `${pct}%`;
    if (waterVal) waterVal.textContent = water.toLocaleString();
    if (waterPct) waterPct.textContent = `${pct}%`;
    updateConcentricMetrics();
  }

  // Toggle Exercise Completion
  cards.forEach(card => {
    const id = card.dataset.id;
    const toggleBtn = card.querySelector('.living-completion-toggle');

    function toggle() {
      if (completed.has(id)) {
        completed.delete(id);
        card.classList.remove('completed');
        if (toggleBtn) toggleBtn.classList.remove('completed');
      } else {
        completed.add(id);
        card.classList.add('completed');
        if (toggleBtn) toggleBtn.classList.add('completed');
      }
      updateConcentricMetrics();
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
      });
    }

    card.addEventListener('click', () => {
      toggle();
    });
  });

  // Switch Routines
  routinePills.forEach(pill => {
    pill.addEventListener('click', () => {
      routinePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const rout = pill.dataset.routine;
      if (rout === 'push') {
        routineTitle.textContent = 'Push Power Momentum';
      } else if (rout === 'pull') {
        routineTitle.textContent = 'Pull Surge Protocol';
      } else if (rout === 'legs') {
        routineTitle.textContent = 'Leg Engine & Kinetic Force';
      }

      completed.clear();
      cards.forEach(card => {
        card.classList.remove('completed');
        const toggleBtn = card.querySelector('.living-completion-toggle');
        if (toggleBtn) toggleBtn.classList.remove('completed');
      });
      updateConcentricMetrics();
    });
  });

  // Filter Chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;

      cards.forEach(card => {
        const cat = card.dataset.cat;
        if (activeFilter === 'all' || cat === activeFilter) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  // Hydration Sips
  sipBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const add = parseInt(btn.dataset.add, 10);
      water += add;
      updateFluidTank();
    });
  });

  updateFluidTank();
});

