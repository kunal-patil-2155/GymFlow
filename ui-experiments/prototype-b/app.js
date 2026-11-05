// GymFlow Prototype B: Athletic Intelligence Interactive Controller

document.addEventListener('DOMContentLoaded', () => {
  let completed = new Set(['e1', 'e2']);
  let water = 1800;
  const waterGoal = 3000;
  let activeFilter = 'all';

  const cards = document.querySelectorAll('.ath-card');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const routineSelect = document.getElementById('b-routine-select');
  const routineTitle = document.getElementById('b-routine-title');
  const completedRatio = document.getElementById('b-completed-ratio');
  const progressFill = document.getElementById('b-progress-fill');
  const progressPct = document.getElementById('b-progress-pct');
  const counterLabel = document.getElementById('b-counter-label');
  const todayBar = document.getElementById('b-today-bar');

  // Hydration
  const waterText = document.getElementById('b-water-text');
  const waterBar = document.getElementById('b-water-bar');
  const waterPct = document.getElementById('b-water-pct');
  const quickBtns = document.querySelectorAll('.ath-quick-btn');

  function updateProgress() {
    const total = cards.length;
    const count = completed.size;
    const pct = total === 0 ? 0 : Math.round((count / total) * 100);

    if (completedRatio) completedRatio.textContent = `${count} / ${total}`;
    if (progressFill) progressFill.style.width = `${pct}%`;
    if (progressPct) progressPct.textContent = `${pct}% OF PLANNED WORKOUT COMPLETED`;
    if (counterLabel) counterLabel.textContent = `${total - count} EXERCISES REMAINING`;
    if (todayBar) todayBar.style.height = `${Math.max(15, pct)}%`;
  }

  function updateHydration() {
    const pct = Math.min(100, Math.round((water / waterGoal) * 100));
    if (waterText) waterText.textContent = `${water.toLocaleString()} ML`;
    if (waterBar) waterBar.style.width = `${pct}%`;
    if (waterPct) waterPct.textContent = `${pct}%`;
  }

  // Toggle Cards
  cards.forEach(card => {
    const id = card.dataset.id;
    const btn = card.querySelector('.ath-check-btn');
    const badge = card.querySelector('.ath-status-badge');

    function toggle() {
      if (completed.has(id)) {
        completed.delete(id);
        card.classList.remove('completed');
        if (btn) btn.classList.remove('checked');
        if (badge) {
          badge.textContent = 'PENDING';
          badge.classList.add('pending');
        }
      } else {
        completed.add(id);
        card.classList.add('completed');
        if (btn) btn.classList.add('checked');
        if (badge) {
          badge.textContent = 'LOGGED';
          badge.classList.remove('pending');
        }
      }
      updateProgress();
    }

    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
      });
    }

    card.addEventListener('click', () => {
      toggle();
    });
  });

  // Filters
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;

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

  // Water buttons
  quickBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const add = parseInt(btn.dataset.add, 10);
      water += add;
      updateHydration();
    });
  });

  // Routine Switcher
  if (routineSelect) {
    routineSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'push') {
        routineTitle.textContent = 'HEAVY PUSH & DELT DRIVE';
      } else if (val === 'pull') {
        routineTitle.textContent = 'HYPERTROPHY PULL & POSTERIOR CHAIN';
      } else if (val === 'legs') {
        routineTitle.textContent = 'LEG DRIVE & KINETIC POWER';
      }
      completed.clear();
      cards.forEach(card => {
        card.classList.remove('completed');
        const btn = card.querySelector('.ath-check-btn');
        const badge = card.querySelector('.ath-status-badge');
        if (btn) btn.classList.remove('checked');
        if (badge) {
          badge.textContent = 'PENDING';
          badge.classList.add('pending');
        }
      });
      updateProgress();
    });
  }

  updateProgress();
  updateHydration();
});

