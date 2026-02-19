/* GWPL Security — Emergency Audit Form Logic */

var currentStep = 1;
var totalSteps  = 4;

function goToStep(step) {
  if (step < 1 || step > totalSteps) return;
  document.getElementById('panel' + currentStep).classList.remove('active');
  document.getElementById('tab'   + currentStep).classList.remove('active');
  if (step > currentStep) {
    document.getElementById('tab' + currentStep).classList.add('completed');
    var num = document.querySelector('#tab' + currentStep + ' .step-tab-num');
    if (num) num.textContent = '✓';
  }
  currentStep = step;
  document.getElementById('panel' + currentStep).classList.add('active');
  document.getElementById('tab'   + currentStep).classList.add('active');
  document.getElementById('tab'   + currentStep).classList.remove('completed');
  updateNav();
  document.getElementById('auditFormCard').scrollIntoView({behavior:'smooth', block:'start'});
}

function nextStep() {
  if (currentStep < totalSteps) { goToStep(currentStep + 1); }
  else { submitForm(); }
}

function prevStep() {
  if (currentStep > 1) {
    document.getElementById('panel' + currentStep).classList.remove('active');
    document.getElementById('tab'   + currentStep).classList.remove('active');
    currentStep--;
    document.getElementById('panel' + currentStep).classList.add('active');
    document.getElementById('tab'   + currentStep).classList.add('active');
    document.getElementById('tab'   + currentStep).classList.remove('completed');
    document.querySelector('#tab' + currentStep + ' .step-tab-num').textContent = currentStep;
    updateNav();
    document.getElementById('auditFormCard').scrollIntoView({behavior:'smooth', block:'start'});
  }
}

function updateNav() {
  var prev    = document.getElementById('btnPrev');
  var next    = document.getElementById('btnNext');
  var counter = document.getElementById('stepCounter');
  prev.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  counter.textContent   = 'Step ' + currentStep + ' of ' + totalSteps;
  if (currentStep === totalSteps) {
    next.textContent         = '⚡ Submit Emergency Request';
    next.style.background    = 'var(--red-alert)';
    next.style.clipPath      = 'none';
    next.style.padding       = '14px 28px';
  } else {
    next.textContent         = 'Continue ▶';
    next.style.background    = 'var(--gold)';
    next.style.clipPath      = 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)';
  }
}

async function submitForm() {
  var consent = document.getElementById('f-consent');
  if (!consent || !consent.checked) {
    if (consent) consent.closest('label').style.color = '#e74c3c';
    return;
  }

  var btnNext = document.getElementById('btnNext');
  btnNext.textContent = 'Submitting...';
  btnNext.disabled    = true;

  // Collect all form data
  var formData = new FormData();
  var fields = [
    'f-firstname','f-lastname','f-jobtitle','f-clearance',
    'f-phone','f-email','f-org','f-orgtype','f-state',
    'f-threattype','f-datetime','f-summary','f-startdate'
  ];
  var fieldMap = {
    'f-firstname': 'first_name', 'f-lastname': 'last_name',
    'f-jobtitle':  'job_title',  'f-clearance': 'clearance_level',
    'f-phone':     'phone_primary', 'f-email': 'email',
    'f-org':       'organisation_name', 'f-orgtype': 'organisation_type',
    'f-state':     'state_region', 'f-threattype': 'threat_type',
    'f-datetime':  'incident_datetime', 'f-summary': 'situation_summary',
    'f-startdate': 'desired_start_date'
  };
  fields.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) formData.append(fieldMap[id] || id, el.value);
  });

  // Radio: contact preference
  var cpref = document.querySelector('input[name="contact-pref"]:checked');
  if (cpref) formData.append('contact_preference', cpref.value);

  // Radio: threat level
  var tlevel = document.querySelector('input[name="threat-level"]:checked');
  if (tlevel) formData.append('threat_level', tlevel.value);

  // Checkboxes: sectors
  document.querySelectorAll('input[name="sector"]:checked').forEach(function(cb) {
    formData.append('sectors[]', cb.value);
  });

  // Checkboxes: services
  document.querySelectorAll('input[name="services"]:checked').forEach(function(cb) {
    formData.append('services_required[]', cb.value);
  });

  // File attachments
  var fileInput = document.getElementById('fileInput');
  if (fileInput && fileInput.files) {
    Array.from(fileInput.files).forEach(function(f) {
      formData.append('attachments', f);
    });
  }

  try {
    var res  = await fetch('/api/audit/submit', { method: 'POST', body: formData });
    var data = await res.json();

    if (data.success) {
      // Hide form, show success
      for (var i = 1; i <= totalSteps; i++) {
        var p = document.getElementById('panel' + i);
        if (p) p.style.display = 'none';
      }
      document.getElementById('formNav').style.display   = 'none';
      document.getElementById('stepBar').style.display   = 'none';
      document.getElementById('refNumber').textContent   = data.reference_number;
      document.getElementById('successScreen').classList.add('active');
    } else {
      alert('Submission error. Please call our emergency hotline: +234 800 GWPL SEC');
      btnNext.textContent = '⚡ Submit Emergency Request';
      btnNext.disabled    = false;
    }
  } catch (err) {
    alert('Network error. Please call our emergency hotline: +234 800 GWPL SEC');
    btnNext.textContent = '⚡ Submit Emergency Request';
    btnNext.disabled    = false;
  }
}

// File input display
document.addEventListener('DOMContentLoaded', function() {
  var fi = document.getElementById('fileInput');
  if (!fi) return;
  fi.addEventListener('change', function() {
    var list = document.getElementById('file-list');
    if (!list) return;
    list.innerHTML = '';
    Array.from(this.files).forEach(function(f) {
      list.innerHTML += '<div style="padding:6px 0;border-bottom:1px solid rgba(201,168,76,0.1);display:flex;gap:8px;align-items:center;">'
        + '<span style="color:var(--gold)">📄</span> ' + f.name
        + '<span style="color:rgba(245,245,245,0.3);margin-left:auto;">' + (f.size/1024).toFixed(0) + 'KB</span></div>';
    });
  });
});