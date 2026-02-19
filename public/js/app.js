/* GWPL Security — Main Application Script */

// ── PAGE NAVIGATION ──
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  var target = document.getElementById('page-' + id);
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(applyImages, 50);
}

function showTab(ev, id) {
  document.querySelectorAll('.client-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.ctab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  if (ev && ev.currentTarget) {
    ev.currentTarget.classList.add('active');
  }
}
  
  // ── ANIMATE BARS ──
  function animateBars() {
    document.querySelectorAll('.bar-fill').forEach(function(bar) {
      var w = bar.getAttribute('data-width') || bar.style.width;
      if (!bar.getAttribute('data-width')) bar.setAttribute('data-width', w);
      bar.style.width = '0';
      setTimeout(function() {
        bar.style.transition = 'width 1.5s ease';
        bar.style.width = bar.getAttribute('data-width');
      }, 300);
    });
  }
  
  // ── IMAGE APPLICATION ──
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
      DRONE: typeof IMG_DRONE !== 'undefined' ? IMG_DRONE : null,
    };
    Object.keys(map).forEach(function(id) {
      var el  = document.getElementById(id);
      var src = imgs[map[id]];
      if (!el || !src) return;
      if (id === 'hero-bg-el') {
        el.style.backgroundImage = "url('" + src + "')";
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.opacity = '0.15';
        el.style.position = 'absolute';
        el.style.inset = '0';
      } else {
        el.src = src;
      }
    });
  }
  
  // ── INIT ──
  document.addEventListener('DOMContentLoaded', function() {
    animateBars();
    applyImages();
  });