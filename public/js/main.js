// GWPL Security — Frontend behavior

// ── PAGE NAVIGATION / SPA ──
function showPage(id) {
  document.querySelectorAll('.page').forEach(function (p) {
    p.classList.remove('active');
  });
  var target = document.getElementById('page-' + id);
  if (target) target.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Re-apply images after page switch
  setTimeout(applyImages, 50);

  // Close mobile nav after navigation
  var nav = document.getElementById('main-nav');
  var toggle = document.querySelector('.nav-toggle');
  if (nav && toggle) {
    nav.classList.remove('is-open');
    toggle.classList.remove('is-open');
  }
}

function toggleNav() {
  var nav = document.getElementById('main-nav');
  var toggle = document.querySelector('.nav-toggle');
  if (!nav || !toggle) return;
  nav.classList.toggle('is-open');
  toggle.classList.toggle('is-open');
}

function showTab(id) {
  document.querySelectorAll('.client-content').forEach(function (c) {
    c.classList.remove('active');
  });
  document.querySelectorAll('.ctab').forEach(function (t) {
    t.classList.remove('active');
  });
  var panel = document.getElementById('tab-' + id);
  if (panel) panel.classList.add('active');
  if (typeof event !== 'undefined' && event.target) {
    event.target.classList.add('active');
  }
}

// ── GSOC stats bar animation ──
function animateBars() {
  document.querySelectorAll('.bar-fill').forEach(function (bar) {
    var w = bar.getAttribute('data-width') || bar.style.width;
    if (!bar.getAttribute('data-width')) bar.setAttribute('data-width', w);
    bar.style.width = '0';
    setTimeout(function () {
      bar.style.transition = 'width 1.5s ease';
      bar.style.width = bar.getAttribute('data-width');
    }, 300);
  });
}

// ── Apply hero / section images from base64 globals ──
function applyImages() {
  var map = {
    'hero-bg-el':       'FULL',
    'gsoc-img':         'GSOC',
    'field-img':        'FIELD',
    'field-img2':       'FIELD',
    'tech-img':         'TECH',
    'drone-img':        'DRONE',
    'contact-hero-img': 'GSOC'
  };

  var imgs = {
    FULL:  typeof IMG_FULL  !== 'undefined' ? IMG_FULL  : null,
    GSOC:  typeof IMG_GSOC  !== 'undefined' ? IMG_GSOC  : null,
    FIELD: typeof IMG_FIELD !== 'undefined' ? IMG_FIELD : null,
    TECH:  typeof IMG_TECH  !== 'undefined' ? IMG_TECH  : null,
    DRONE: typeof IMG_DRONE !== 'undefined' ? IMG_DRONE : null
  };

  Object.keys(map).forEach(function (id) {
    var el = document.getElementById(id);
    var src = imgs[map[id]];
    if (!el || !src) return;
    if (id === 'hero-bg-el') {
      el.style.backgroundImage = "url('" + src + "')";
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    } else if (el.tagName === 'IMG') {
      el.src = src;
    } else {
      el.style.backgroundImage = "url('" + src + "')";
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    }
  });
}

// ── AUDIT MULTI-STEP FORM ──
var currentStep = 1;
var totalSteps = 4;

function goToStep(step) {
  if (step < 1 || step > totalSteps) return;
  var curPanel = document.getElementById('panel' + currentStep);
  var curTab = document.getElementById('tab' + currentStep);
  if (curPanel) curPanel.classList.remove('active');
  if (curTab) curTab.classList.remove('active');

  if (step > currentStep) {
    if (curTab) {
      curTab.classList.add('completed');
      var num = curTab.querySelector('.step-tab-num');
      if (num) num.textContent = '✓';
    }
  }

  currentStep = step;
  var newPanel = document.getElementById('panel' + currentStep);
  var newTab = document.getElementById('tab' + currentStep);
  if (newPanel) newPanel.classList.add('active');
  if (newTab) {
    newTab.classList.add('active');
    newTab.classList.remove('completed');
  }
  updateNav();
  var card = document.getElementById('auditFormCard');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function nextStep() {
  if (currentStep < totalSteps) {
    goToStep(currentStep + 1);
  } else {
    submitForm();
  }
}

function prevStep() {
  if (currentStep > 1) {
    var curPanel = document.getElementById('panel' + currentStep);
    var curTab = document.getElementById('tab' + currentStep);
    if (curPanel) curPanel.classList.remove('active');
    if (curTab) curTab.classList.remove('active');

    currentStep--;

    var newPanel = document.getElementById('panel' + currentStep);
    var newTab = document.getElementById('tab' + currentStep);
    if (newPanel) newPanel.classList.add('active');
    if (newTab) {
      newTab.classList.add('active');
      newTab.classList.remove('completed');
      var num = newTab.querySelector('.step-tab-num');
      if (num) num.textContent = currentStep;
    }
    updateNav();
    var card = document.getElementById('auditFormCard');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateNav() {
  var prev = document.getElementById('btnPrev');
  var next = document.getElementById('btnNext');
  var counter = document.getElementById('stepCounter');
  if (prev) prev.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  if (counter) counter.textContent = 'Step ' + currentStep + ' of ' + totalSteps;
  if (!next) return;

  if (currentStep === totalSteps) {
    next.textContent = '⚡ Submit Emergency Request';
    next.style.background = 'var(--red-alert)';
    next.style.clipPath = 'none';
    next.style.padding = '14px 28px';
  } else {
    next.textContent = 'Continue ▶';
    next.style.background = 'var(--gold)';
    next.style.clipPath = 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)';
  }
}

function submitForm() {
  var consent = document.getElementById('f-consent');
  if (!consent || !consent.checked) {
    if (consent) {
      var fg = consent.closest('.fg');
      if (fg) fg.scrollIntoView({ behavior: 'smooth' });
      var label = consent.closest('label');
      if (label) label.style.color = '#e74c3c';
    }
    return;
  }

  for (var i = 1; i <= totalSteps; i++) {
    var p = document.getElementById('panel' + i);
    if (p) p.style.display = 'none';
  }

  var formNav = document.getElementById('formNav');
  var stepBar = document.getElementById('stepBar');
  if (formNav) formNav.style.display = 'none';
  if (stepBar) stepBar.style.display = 'none';

  var ref = 'GWPL-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000);
  var refEl = document.getElementById('refNumber');
  if (refEl) refEl.textContent = ref;

  var success = document.getElementById('successScreen');
  if (success) success.classList.add('active');
}

// ── FILE INPUT DISPLAY ──
function initFileList() {
  var fileInput = document.getElementById('fileInput');
  if (!fileInput) return;

  fileInput.addEventListener('change', function () {
    var list = document.getElementById('file-list');
    if (!list) return;
    list.innerHTML = '';
    Array.from(fileInput.files || []).forEach(function (f) {
      var sizeKb = (f.size / 1024).toFixed(0);
      list.innerHTML +=
        '<div style="padding:6px 0; border-bottom:1px solid rgba(201,168,76,0.1); display:flex; gap:8px; align-items:center;">' +
        '<span style="color:var(--gold)">📄</span> ' + f.name +
        ' <span style="color:rgba(245,245,245,0.3); margin-left:auto;">' + sizeKb + 'KB</span></div>';
    });
  });
}

// ── INITIALISATION ──
document.addEventListener('DOMContentLoaded', function () {
  applyImages();
  animateBars();
  updateNav();
  initFileList();
});

