/* ============================================
   CONFIG
   ============================================ */

const CONFIG = {
  whatsapp: '34623345790',
  formspreeContact: 'https://formspree.io/f/xgopbnvg',
};


/* ============================================
   INIT
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  setupNav();
  setupContactForm();
  setupLanguageAutoRedirect();
});


/* ============================================
   NAV (mobile toggle)
   ============================================ */

function setupNav() {
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  if (!nav || !toggle) return;

  toggle.addEventListener('click', () => {
    nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', nav.classList.contains('open'));
  });

  // Close on link click (mobile)
  nav.querySelectorAll('.nav-links a').forEach(a => {
    a.addEventListener('click', () => nav.classList.remove('open'));
  });
}


/* ============================================
   CONTACT FORM (Formspree AJAX)
   ============================================ */

function setupContactForm() {
  const form = document.getElementById('form-contact');
  if (!form) return;

  const endpoint = CONFIG.formspreeContact;
  form.setAttribute('action', endpoint);
  form.setAttribute('method', 'POST');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const consent = form.querySelector('input[name="consent"]');
    if (consent && !consent.checked) {
      const feedback = form.querySelector('.form-feedback');
      feedback.textContent = form.dataset.consentError || 'Please accept the privacy policy.';
      feedback.className = 'form-feedback error';
      return;
    }

    const submitBtn = form.querySelector('[type="submit"]');
    const feedback = form.querySelector('.form-feedback');
    const originalText = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.textContent = form.dataset.sending || 'Enviando...';
    feedback.textContent = '';
    feedback.className = 'form-feedback';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        feedback.textContent = form.dataset.success || 'Gracias. Te responderemos en 24h.';
        feedback.classList.add('success');
        form.reset();
      } else {
        throw new Error('Server error');
      }
    } catch {
      feedback.textContent = form.dataset.error || 'Error al enviar. Inténtalo de nuevo.';
      feedback.classList.add('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}


/* ============================================
   LANGUAGE AUTO-REDIRECT (first visit only)
   ============================================ */

function setupLanguageAutoRedirect() {
  // Only on the ES home and only once — respect user's explicit choice thereafter.
  if (sessionStorage.getItem('rz-lang-seen')) return;
  sessionStorage.setItem('rz-lang-seen', '1');

  const path = window.location.pathname;
  // Only auto-redirect on the ES root "/" — don't hijack other routes
  if (path !== '/' && path !== '') return;

  const browserLang = (navigator.language || 'es').toLowerCase();
  if (browserLang.startsWith('en') && !path.startsWith('/en')) {
    window.location.replace('/en/');
  }
}
