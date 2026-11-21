// The demo product's behaviour: pages, the New customer drawer, the plan menu, the command menu and the toast.
// All data is made up and lives here; nothing is saved and nothing leaves the page. The short waits (the drawer
// getting ready, a page loading, saving) are on purpose: they give a capture the waits and page changes that the
// capture-family previews look for.
(() => {
  const $ = (id) => document.getElementById(id);
  const COLOURS = ['#1F6B45', '#C9822B', '#2F5D50', '#8A6A3B', '#3F7F63', '#A4612A'];
  const customers = [
    ['Acme Bakery', 'Team', 18, 'Active'],
    ['Demo Garden', 'Starter', 4, 'Active'],
    ['Acme Freight', 'Business', 64, 'Active'],
    ['Demo Books', 'Starter', 3, 'Trial'],
    ['Acme Cycles', 'Team', 22, 'Active'],
    ['Demo Coffee Bar', 'Starter', 5, 'Paused'],
    ['Acme Print Shop', 'Team', 12, 'Active'],
    ['Demo Studio', 'Business', 40, 'Active'],
    ['Acme Tiles', 'Starter', 2, 'Trial'],
    ['Demo Pantry', 'Team', 15, 'Active'],
    ['Acme Repairs', 'Team', 9, 'Active'],
    ['Demo Florist', 'Starter', 3, 'Active'],
    ['Acme Outdoor', 'Business', 51, 'Active'],
    ['Demo Gym', 'Team', 27, 'Paused'],
    ['Acme Lighting', 'Starter', 4, 'Active'],
    ['Demo Kitchen', 'Team', 11, 'Active'],
  ];

  const initials = (name) => name.split(' ').filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('');
  const rowHtml = ([name, plan, seats, status], i) => `
    <div class="table-row" role="listitem">
      <span class="name"><i class="logo-tile" style="background:${COLOURS[i % COLOURS.length]}">${initials(name)}</i>${name}</span>
      <span class="pill${plan === 'Business' ? ' warm' : ''}">${plan}</span>
      <span>${seats}</span>
      <span class="status${status === 'Paused' ? ' paused' : status === 'Trial' ? ' trial' : ''}">${status}</span>
    </div>`;
  const drawRows = () => {
    const q = $('filter').value.trim().toLowerCase();
    $('customer-rows').innerHTML = customers.map(rowHtml).filter((_, i) => customers[i][0].toLowerCase().includes(q)).join('');
    $('all-rows').innerHTML = customers.map(rowHtml).join('');
  };
  $('filter').addEventListener('input', drawRows);

  // ------------------------------------------------ charts
  const bars = (svg, axis, values, labels, height) => {
    const w = 640;
    const max = Math.max(...values) * 1.15;
    const step = w / values.length;
    let out = '';
    for (let g = 1; g <= 3; g++) out += `<line class="grid" x1="0" x2="${w}" y1="${(height * g) / 4}" y2="${(height * g) / 4}"/>`;
    values.forEach((v, i) => {
      const h = (v / max) * height;
      out += `<rect class="bar${i === values.length - 1 ? ' now' : ''}" x="${i * step + step * 0.18}" y="${height - h}" width="${step * 0.64}" height="${h}" rx="5"/>`;
    });
    const pts = values.map((v, i) => `${i * step + step / 2},${height - (v / max) * height - 14}`).join(' ');
    out += `<polyline class="line" points="${pts}"/>`;
    svg.innerHTML = out;
    axis.innerHTML = labels.map((l) => `<span>${l}</span>`).join('');
  };
  const weeks = ['Sep 1', 'Sep 8', 'Sep 15', 'Sep 22', 'Sep 29', 'Oct 6', 'Oct 13', 'Oct 20', 'Oct 27', 'Nov 3', 'Nov 10', 'Nov 17'];
  const drawOverviewChart = () => bars($('chart'), $('chart-axis'), [11.2, 12.1, 11.8, 13.4, 13.9, 13.1, 14.8, 15.2, 15.9, 16.4, 17.6, 18.4], weeks, 240);
  const reports = {
    weekly: { title: 'Customers added each week', values: [4, 6, 5, 7, 6, 8, 7, 9, 8, 10, 9, 12], labels: weeks },
    monthly: { title: 'Customers added each month', values: [14, 17, 16, 21, 19, 24, 23, 26, 25, 29, 31, 32], labels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'] },
  };
  const drawReport = (range) => {
    const r = reports[range];
    $('report-title').textContent = r.title;
    bars($('report-chart'), $('report-axis'), r.values, r.labels, 260);
    $('tab-weekly').setAttribute('aria-selected', String(range === 'weekly'));
    $('tab-monthly').setAttribute('aria-selected', String(range === 'monthly'));
  };
  const drawPlans = () => {
    const plans = [['Team', 112], ['Starter', 86], ['Business', 50]];
    $('plan-list').innerHTML = plans.map(([p, n]) => `<li><div>${p}<span>${n} customers</span></div><p class="meter"><i style="width:${(n / 112) * 100}%"></i></p></li>`).join('');
  };

  // ------------------------------------------------ the day (the capture tool sets a demo clock)
  const drawToday = () => {
    const now = new Date();
    const h = now.getHours();
    $('greeting').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const day = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    $('today').textContent = `${day}, and here is how your customers are doing.`;
  };

  // ------------------------------------------------ pages
  const TITLES = { overview: 'Overview', customers: 'Customers', reports: 'Reports', settings: 'Settings' };
  const pageOf = (path) => (path.replace(/^\/|\/$/g, '') || 'overview');
  const show = (page) => {
    for (const el of document.querySelectorAll('.page')) el.hidden = el.dataset.page !== page;
    for (const a of document.querySelectorAll('nav a')) a.classList.toggle('active', a.dataset.go === page);
    $('page-title').textContent = TITLES[page] ?? 'Overview';
  };
  /** Opens a page after a short load, as a real product fetching its data would. */
  const go = (page) => {
    if (!TITLES[page]) page = 'overview';
    history.pushState({ page }, '', page === 'overview' ? '/' : `/${page}`);
    for (const el of document.querySelectorAll('.page')) el.hidden = true;
    for (const a of document.querySelectorAll('nav a')) a.classList.toggle('active', a.dataset.go === page);
    $('page-title').textContent = TITLES[page];
    const loading = $('page-loading');
    loading.hidden = false;
    loading.setAttribute('aria-busy', 'true');
    setTimeout(() => { loading.hidden = true; loading.removeAttribute('aria-busy'); show(page); }, 900);
  };
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-go]');
    if (!link) return;
    e.preventDefault();
    go(link.dataset.go);
  });
  window.addEventListener('popstate', () => show(pageOf(location.pathname)));

  // ------------------------------------------------ the New customer drawer
  let plan = 'Starter';
  const openDrawer = () => {
    $('scrim').hidden = false;
    $('drawer').hidden = false;
    $('customer-form').hidden = true;
    const wait = $('drawer-loading');
    wait.hidden = false;
    wait.setAttribute('aria-busy', 'true');
    setTimeout(() => { wait.hidden = true; wait.removeAttribute('aria-busy'); $('customer-form').hidden = false; }, 1100);
  };
  const closeDrawer = () => {
    $('scrim').hidden = true;
    $('drawer').hidden = true;
    $('plan-menu').hidden = true;
    $('plan').setAttribute('aria-expanded', 'false');
  };
  const resetForm = () => {
    $('company').value = '';
    plan = 'Starter';
    $('plan-value').textContent = plan;
    $('seats').value = 5;
    seats();
    setToggle($('welcome'), false);
    $('save').disabled = false;
    $('save').textContent = 'Save customer';
  };
  $('new-customer').addEventListener('click', () => { resetForm(); openDrawer(); });
  $('close-drawer').addEventListener('click', closeDrawer);
  $('cancel').addEventListener('click', closeDrawer);
  $('scrim').addEventListener('click', closeDrawer);

  $('plan').addEventListener('click', () => {
    const menu = $('plan-menu');
    menu.hidden = !menu.hidden;
    $('plan').setAttribute('aria-expanded', String(!menu.hidden));
  });
  for (const li of document.querySelectorAll('#plan-menu li')) {
    li.addEventListener('click', () => {
      plan = li.dataset.plan;
      $('plan-value').textContent = plan;
      for (const x of document.querySelectorAll('#plan-menu li')) x.setAttribute('aria-selected', String(x === li));
      $('plan-menu').hidden = true;
      $('plan').setAttribute('aria-expanded', 'false');
    });
  }
  const seats = () => {
    const s = $('seats');
    $('seats-value').textContent = s.value;
    s.style.setProperty('--fill', `${((s.value - s.min) / (s.max - s.min)) * 100}%`);
  };
  $('seats').addEventListener('input', seats);

  const setToggle = (t, on) => { t.classList.toggle('on', on); t.setAttribute('aria-checked', String(on)); };
  for (const t of document.querySelectorAll('.toggle')) t.addEventListener('click', (e) => { e.preventDefault(); setToggle(t, !t.classList.contains('on')); });

  let toastTimer = null;
  $('customer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('company').value.trim() || 'Acme Studio';
    $('save').disabled = true;
    $('save').textContent = 'Saving';
    setTimeout(() => {
      closeDrawer();
      customers.unshift([name, plan, Number($('seats').value), 'Active']);
      drawRows();
      $('customer-rows').firstElementChild.classList.add('fresh');
      $('active-count').textContent = String(Number($('active-count').textContent) + 1);
      $('toast-detail').textContent = `${name} is on the ${plan} plan`;
      $('toast').hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6000);
    }, 800);
  });

  // ------------------------------------------------ the command menu (Cmd+K)
  const COMMANDS = [
    { label: 'Go to Reports', hint: 'Page', run: () => go('reports') },
    { label: 'Go to Customers', hint: 'Page', run: () => go('customers') },
    { label: 'Go to Overview', hint: 'Page', run: () => go('overview') },
    { label: 'New customer', hint: 'Action', run: () => { resetForm(); openDrawer(); } },
    { label: 'Open Settings', hint: 'Page', run: () => go('settings') },
  ];
  let matches = COMMANDS;
  const drawCommands = () => {
    const q = $('command-input').value.trim().toLowerCase();
    matches = COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
    $('command-list').innerHTML = matches.map((c, i) => `<li role="option" class="${i === 0 ? 'on' : ''}">${c.label}<span>${c.hint}</span></li>`).join('');
  };
  const openCommands = () => { $('commands').hidden = false; $('command-input').value = ''; drawCommands(); $('command-input').focus(); };
  const closeCommands = () => { $('commands').hidden = true; };
  $('open-commands').addEventListener('click', openCommands);
  $('command-input').addEventListener('input', drawCommands);
  $('commands').addEventListener('click', (e) => { if (e.target === $('commands')) closeCommands(); });
  $('command-list').addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const i = [...$('command-list').children].indexOf(li);
    closeCommands();
    matches[i]?.run();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommands(); return; }
    if ($('commands').hidden) { if (e.key === 'Escape') closeDrawer(); return; }
    if (e.key === 'Escape') closeCommands();
    if (e.key === 'Enter' && matches[0]) { e.preventDefault(); closeCommands(); matches[0].run(); }
  });

  $('tab-weekly').addEventListener('click', () => drawReport('weekly'));
  $('tab-monthly').addEventListener('click', () => drawReport('monthly'));

  drawRows();
  drawOverviewChart();
  drawReport('weekly');
  drawPlans();
  drawToday();
  seats();
  show(pageOf(location.pathname));
})();
