/* ============================================
   CONFIGURATION
   Edit these values to update WhatsApp number
   or form endpoints.
   ============================================ */

const CONFIG = {
  whatsapp: '34623345790',
  formspreeSugerencias: 'https://formspree.io/f/xlgokpda',
  formspreeSoporte: 'https://formspree.io/f/xgopbnvg',
};


/* ============================================
   INIT
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  setupIntro();
  setupModals();
  setupForms();
});


/* ============================================
   INTRO (QR scan zoom)
   ============================================ */

function setupIntro() {
  const overlay = document.getElementById('introOverlay');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!overlay || prefersReduced) {
    // Skip intro, show cards immediately
    overlay?.classList.add('done');
    setupEntranceAnimation();
    return;
  }

  // Wait for intro animation to finish, then remove overlay and start card entrance
  overlay.addEventListener('animationend', (e) => {
    if (e.target === overlay) {
      overlay.classList.add('done');
      setupEntranceAnimation();
    }
  });
}


/* ============================================
   ENTRANCE ANIMATION
   ============================================ */

function setupEntranceAnimation() {
  const splat = document.querySelector('.splat-logo');
  const cards = document.querySelectorAll('.card');
  const sparks = document.querySelectorAll('.spark-connector');
  const privacyLink = document.querySelector('.privacy-link');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReduced) {
    // Show everything immediately
    splat?.classList.add('visible');
    cards.forEach(c => c.classList.add('visible'));
    sparks.forEach(s => s.classList.add('visible'));
    privacyLink?.classList.add('visible');
    return;
  }

  // Staggered reveal
  let delay = 200;

  setTimeout(() => {
    splat?.classList.add('visible');
  }, delay);

  delay += 200;

  cards.forEach((card, i) => {
    // Card
    setTimeout(() => {
      card.classList.add('visible');
    }, delay);

    delay += 150;

    // Spark connector after each card (except last)
    if (sparks[i]) {
      setTimeout(() => {
        sparks[i].classList.add('visible');
      }, delay);
      delay += 100;
    }
  });

  // Privacy link at the end
  setTimeout(() => {
    privacyLink?.classList.add('visible');
  }, delay + 100);
}


/* ============================================
   MODAL SYSTEM
   ============================================ */

let activeModal = null;
let triggerElement = null;

function setupModals() {
  // Card buttons open modals
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-modal');
      openModal(modalId, btn);
    });
  });

  // Close buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      if (activeModal) closeModal();
    });
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeModal) {
      closeModal();
    }
  });

  // Browser back button
  window.addEventListener('popstate', () => {
    if (activeModal) {
      closeModal(false); // don't manipulate history
    }
  });

  // Click on backdrop (modal-inner handles content, clicks outside close)
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  });
}

function openModal(id, trigger) {
  const modal = document.getElementById(id);
  if (!modal) return;

  activeModal = modal;
  triggerElement = trigger || null;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  // Push history state so back button closes modal
  history.pushState({ modal: id }, '');

  // Focus the close button
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    setTimeout(() => closeBtn.focus(), 100);
  }

  // Setup focus trap
  setupFocusTrap(modal);
}

function closeModal(pushHistory = true) {
  if (!activeModal) return;

  activeModal.classList.remove('open');
  activeModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');

  // Reset scroll position inside modal
  const body = activeModal.querySelector('.modal-body');
  if (body) body.scrollTop = 0;

  // Return focus to trigger
  if (triggerElement) {
    triggerElement.focus();
  }

  activeModal = null;
  triggerElement = null;

  // Go back in history if we pushed a state
  if (pushHistory && history.state?.modal) {
    history.back();
  }
}

function setupFocusTrap(modal) {
  const focusable = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function trapHandler(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Remove any previous trap handler
  modal._trapHandler && modal.removeEventListener('keydown', modal._trapHandler);
  modal._trapHandler = trapHandler;
  modal.addEventListener('keydown', trapHandler);
}


/* ============================================
   FORM HANDLING
   ============================================ */

function setupForms() {
  setupForm('form-sugerencias', CONFIG.formspreeSugerencias);
  setupForm('form-soporte', CONFIG.formspreeSoporte);
}

function setupForm(formId, endpoint) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.setAttribute('action', endpoint);
  form.setAttribute('method', 'POST');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('.btn-submit');
    const feedback = form.querySelector('.form-feedback');
    const originalText = submitBtn.textContent;

    // Disable button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    feedback.textContent = '';
    feedback.className = 'form-feedback';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        feedback.textContent = 'Enviado. Gracias por tu mensaje.';
        feedback.classList.add('success');
        form.reset();
      } else {
        throw new Error('Server error');
      }
    } catch {
      feedback.textContent = 'Error al enviar. Inténtalo de nuevo.';
      feedback.classList.add('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}
