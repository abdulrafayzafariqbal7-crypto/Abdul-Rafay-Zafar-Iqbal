/**
 * Apple-Style Scroll-Driven 3D Frame Animation Engine
 * Integrated with ABR BATS Experience
 * Full Interactivity, Modals, Smooth Navigation, & Form Engine
 */

(function () {
  'use strict';

  // =========================================================================
  // FORM CONFIGURATION (Option A: Formspree / Option B: Google Apps Script)
  // =========================================================================
  /**
   * To connect real email or spreadsheet notifications:
   * Option A (Formspree): Set contactEndpoint to 'https://formspree.io/f/YOUR_FORM_ID'
   * Option B (Google Sheets): Set to your deployed Google Apps Script Web App URL
   * When empty or demoMode: true, form validates completely and shows live animated feedback!
   */
  const FORM_CONFIG = {
    contactEndpoint: '',
    newsletterEndpoint: '',
    checkoutEndpoint: '',
    demoMode: true
  };

  // State
  let totalFrames = 240;
  let frameFiles = Array.from({ length: 240 }, (_, i) => `ezgif-frame-${String(i + 1).padStart(3, '0')}.jpg`);
  const images = [];
  let currentFrameIndex = -1;
  let isTicking = false;
  let isAutoPlaying = false;
  let autoPlayRafId = null;
  let viewMode = 'cover'; // 'cover' (fills screen, 0 black bars) or 'contain' (full 16:9 view)
  let lastDrawnImg = null;
  let cartCount = 0;

  // Selected Product Configuration State
  const productState = {
    title: 'ABR BATS Black Pro Bat',
    unitPrice: 129.00,
    size: '33"',
    grip: 'Textured Black (0.5mm)',
    qty: 1
  };

  // Proportional scroll travel: 30 pixels of scroll per frame
  const PIXELS_PER_FRAME = 30;

  // DOM Elements - Animation Viewport
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;
  const scrollContainer = document.getElementById('scroll-container');
  const scrollCue = document.getElementById('scroll-cue');
  const heroTitleOverlay = document.getElementById('hero-title-overlay');
  const loader = document.getElementById('loader');
  const progressFill = document.getElementById('progress-fill');
  const loaderPercent = document.getElementById('loader-percent');
  const loaderCount = document.getElementById('loader-count');
  const frameDisplay = document.getElementById('frame-display');
  const progressDisplay = document.getElementById('progress-display');
  const topProgressBar = document.getElementById('top-progress-bar');
  const autoplayBtn = document.getElementById('autoplay-btn');
  const replayBtn = document.getElementById('replay-btn');
  const fitToggleBtn = document.getElementById('fit-toggle-btn');
  const fitText = document.getElementById('fit-text');

  // DOM Elements - Navigation & Cart
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const hamburgerIcon = document.getElementById('hamburger-icon');
  const navbarCartBtn = document.getElementById('navbar-cart-btn');
  const cartCountBadge = document.getElementById('cart-count-badge');
  const navContactBtn = document.getElementById('nav-contact-btn');
  const mobileContactBtn = document.getElementById('mobile-contact-btn');

  // DOM Elements - Modals
  const sizeChartModal = document.getElementById('size-chart-modal');
  const checkoutModal = document.getElementById('checkout-modal');
  const contactModal = document.getElementById('contact-modal');
  const sizeChartBtn = document.getElementById('size-chart-btn');
  const expressCheckoutBtn = document.getElementById('express-checkout-btn');

  // DOM Elements - Toast Notification
  const toastEl = document.getElementById('toast-notification');
  const toastTitle = document.getElementById('toast-title');
  const toastMessage = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');
  let toastTimeout = null;

  /**
   * Global Toast Notification Display
   */
  function showToast(title, message, icon = 'check_circle', isError = false) {
    if (!toastEl) return;
    if (toastTitle) toastTitle.textContent = title;
    if (toastMessage) toastMessage.textContent = message;
    if (toastIcon) {
      toastIcon.textContent = icon;
      toastIcon.className = isError
        ? 'material-symbols-outlined text-rose-400 text-[22px]'
        : 'material-symbols-outlined text-emerald-400 text-[22px]';
    }

    toastEl.classList.remove('hidden');
    toastEl.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('show');
      toastEl.classList.add('hidden');
    }, 4500);
  }

  /**
   * 1. Automatic frame detection via backend API
   */
  async function fetchFrameManifest() {
    try {
      const response = await fetch('/api/frames');
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      totalFrames = data.totalFrames;
      frameFiles = data.frames;
      return data;
    } catch (err) {
      console.warn('API fetch failed, falling back to 240 frames:', err);
      totalFrames = 240;
      frameFiles = [];
      for (let i = 1; i <= 240; i++) {
        const num = String(i).padStart(3, '0');
        frameFiles.push(`ezgif-frame-${num}.jpg`);
      }
      return { totalFrames, frames: frameFiles };
    }
  }

  /**
   * 2. Preload frames: load opening frame immediately, unlock site, and stream remaining frames
   */
  async function preloadAllFrames() {
    images.length = totalFrames;

    // Load opening frame immediately
    const firstFrameFile = frameFiles[0] || 'ezgif-frame-001.jpg';
    const firstImg = new Image();

    await new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        resolve(firstImg);
      };

      firstImg.onload = () => {
        images[0] = firstImg;
        lastDrawnImg = firstImg;
        if (currentFrameIndex <= 0) {
          currentFrameIndex = 0;
          drawFrame(0);
        }
        done();
      };
      firstImg.onerror = done;
      firstImg.src = `frames/${firstFrameFile}`;

      if (firstImg.complete && firstImg.naturalWidth > 0) {
        images[0] = firstImg;
        lastDrawnImg = firstImg;
        currentFrameIndex = 0;
        done();
      }

      // Dismiss preloader after 400ms max
      setTimeout(done, 400);
    });

    // Dismiss preloader and unlock site
    if (progressFill) progressFill.style.width = '100%';
    if (loaderPercent) loaderPercent.textContent = '100%';
    if (loaderCount) loaderCount.textContent = 'Ready';
    document.body.classList.remove('loading');
    if (loader) {
      setTimeout(() => {
        loader.classList.add('hidden');
      }, 100);
    }

    // Set scroll height and size canvas
    updateContainerHeight();
    resizeCanvas();
    drawFrame(0);
    updateFrameByScroll();

    // Check if view mode requested via URL
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam === 'shop' || viewParam === 'product') {
      if (scrollContainer) scrollContainer.style.display = 'none';
      if (loader) loader.classList.add('hidden');
      document.body.classList.remove('loading');
      return;
    }

    const targetFrame = parseInt(urlParams.get('frame') || '0', 10);
    if (targetFrame > 0 && targetFrame < totalFrames) {
      const fImg = new Image();
      fImg.onload = () => {
        images[targetFrame] = fImg;
        currentFrameIndex = targetFrame;
        drawFrame(targetFrame);
        updateUI(targetFrame / totalFrames, targetFrame);
      };
      fImg.src = `frames/${frameFiles[targetFrame]}`;
      if (fImg.complete) {
        images[targetFrame] = fImg;
        currentFrameIndex = targetFrame;
        drawFrame(targetFrame);
        updateUI(targetFrame / totalFrames, targetFrame);
      }
    }

    // Stream remaining frames in background via concurrency pool
    let poolIndex = 1;
    const CONCURRENCY = 4;

    async function worker() {
      while (poolIndex < totalFrames) {
        const idx = poolIndex++;
        const filename = frameFiles[idx];
        if (!filename) continue;

        await new Promise((res) => {
          let resolved = false;
          const done = () => {
            if (resolved) return;
            resolved = true;
            res();
          };

          const img = new Image();
          img.onload = () => {
            images[idx] = img;
            if (currentFrameIndex === idx) {
              drawFrame(idx);
            }
            done();
          };
          img.onerror = done;
          img.src = `frames/${filename}`;

          if (img.complete) {
            images[idx] = img;
            done();
          }

          setTimeout(done, 2000);
        });
      }
    }

    for (let w = 0; w < CONCURRENCY; w++) {
      worker();
    }
  }

  /**
   * 3. Set scrollable container height proportionally to total frames
   */
  function updateContainerHeight() {
    if (!scrollContainer) return;
    const calculatedHeight = window.innerHeight + (totalFrames * PIXELS_PER_FRAME);
    scrollContainer.style.height = `${calculatedHeight}px`;
  }

  /**
   * 4. Canvas aspect ratio & HiDPI resizing
   */
  function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    if (currentFrameIndex >= 0) {
      drawFrame(currentFrameIndex);
    }
  }

  /**
   * 5. Render frame: zero black screen, letterboxing / cover mode
   */
  function drawFrame(index) {
    if (!ctx || !canvas) return;
    const img = images[index] || lastDrawnImg;
    if (!img || !img.naturalWidth) return;

    lastDrawnImg = img;

    const cw = canvas.width;
    const ch = canvas.height;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const imgRatio = imgW / imgH;
    const canvasRatio = cw / ch;

    let drawW, drawH;

    if (viewMode === 'cover') {
      if (canvasRatio > imgRatio) {
        drawW = cw;
        drawH = cw / imgRatio;
      } else {
        drawH = ch;
        drawW = ch * imgRatio;
      }
    } else {
      if (canvasRatio > imgRatio) {
        drawH = ch;
        drawW = ch * imgRatio;
      } else {
        drawW = cw;
        drawH = cw / imgRatio;
      }
    }

    const drawX = (cw - drawW) / 2;
    const drawY = (ch - drawH) / 2;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (viewMode === 'contain') {
      const grad = ctx.createLinearGradient(0, 0, cw, ch);
      grad.addColorStop(0, '#e6bab1');
      grad.addColorStop(0.5, '#d0b8d8');
      grad.addColorStop(1, '#9bbeef');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);
    }

    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  /**
   * 6. Scroll Engine: Update Canvas, Hero Title Fade (0% - 30%), and UI Telemetry
   */
  function updateFrameByScroll() {
    if (!scrollContainer) return;
    const scrollableHeight = scrollContainer.offsetHeight;
    const windowHeight = window.innerHeight;
    const maxScroll = Math.max(1, scrollableHeight - windowHeight);

    // Compute clamped scroll progress between 0 and 1
    let scrollProgress = window.scrollY / maxScroll;
    scrollProgress = Math.max(0, Math.min(1, scrollProgress));

    // Exact formula
    const frameIndex = Math.min(
      totalFrames - 1,
      Math.floor(scrollProgress * totalFrames)
    );

    // Avoid redrawing identical frames
    if (frameIndex !== currentFrameIndex) {
      currentFrameIndex = frameIndex;
      drawFrame(currentFrameIndex);
    }

    // Fade scroll cue if user has scrolled beyond 3%
    if (scrollCue) {
      if (scrollProgress > 0.03) {
        scrollCue.classList.add('faded');
      } else {
        scrollCue.classList.remove('faded');
      }
    }

    // =======================================================================
    // REQUIREMENT: Hero Heading & Subheading Fades Out smoothly 0% - 30%
    // Smooth mathematical interpolation tied to scrollProgress
    // Stays completely hidden when scrollProgress > 0.30
    // =======================================================================
    if (heroTitleOverlay) {
      if (scrollProgress <= 0.30) {
        const fade = Math.max(0, 1 - (scrollProgress / 0.30));
        const translateY = -((scrollProgress / 0.30) * 35);
        heroTitleOverlay.style.opacity = fade.toFixed(4);
        heroTitleOverlay.style.transform = `translateY(${translateY.toFixed(1)}px)`;
        heroTitleOverlay.style.pointerEvents = fade < 0.05 ? 'none' : 'auto';
        heroTitleOverlay.style.visibility = 'visible';
        heroTitleOverlay.style.display = 'flex';
      } else {
        heroTitleOverlay.style.opacity = '0';
        heroTitleOverlay.style.pointerEvents = 'none';
        heroTitleOverlay.style.visibility = 'hidden';
        heroTitleOverlay.style.display = 'none';
      }
    }

    // Update UI elements
    updateUI(scrollProgress, currentFrameIndex);
  }

  /**
   * Update header badges & progress bars
   */
  function updateUI(scrollProgress, frameIndex) {
    if (frameDisplay) {
      const displayIndex = String(frameIndex + 1).padStart(3, '0');
      frameDisplay.textContent = `${displayIndex} / ${totalFrames}`;
    }

    const percentText = `${Math.round(scrollProgress * 100)}%`;
    if (progressDisplay) progressDisplay.textContent = percentText;
    if (topProgressBar) topProgressBar.style.width = `${scrollProgress * 100}%`;
  }

  /**
   * Throttled scroll listener via requestAnimationFrame
   */
  function onScroll() {
    if (!isTicking) {
      requestAnimationFrame(() => {
        updateFrameByScroll();
        isTicking = false;
      });
      isTicking = true;
    }
  }

  /**
   * Toggle between Cover (Full Bleed) and Contain (16:9 Fit)
   */
  function toggleViewMode() {
    viewMode = viewMode === 'cover' ? 'contain' : 'cover';
    if (fitText) {
      fitText.textContent = viewMode === 'cover' ? 'Cover Mode' : 'Fit 16:9 Mode';
    }
    if (currentFrameIndex >= 0) {
      drawFrame(currentFrameIndex);
    }
  }

  /**
   * Auto-Play preview (Smoothly previews 3D animation section)
   */
  function toggleAutoPlay() {
    if (isAutoPlaying) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  }

  function startAutoPlay() {
    isAutoPlaying = true;
    if (autoplayBtn) {
      autoplayBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
        <span class="btn-text">Pause</span>
      `;
    }

    const scrollableHeight = scrollContainer.offsetHeight;
    const windowHeight = window.innerHeight;
    const maxScroll = Math.max(1, scrollableHeight - windowHeight);

    if (window.scrollY >= maxScroll - 10) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    const duration = 10000; // 10s preview
    const startScrollY = window.scrollY;
    const distance = maxScroll - startScrollY;
    const startTime = performance.now();

    function step(now) {
      if (!isAutoPlaying) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      window.scrollTo(0, startScrollY + (distance * progress));

      if (progress < 1) {
        autoPlayRafId = requestAnimationFrame(step);
      } else {
        stopAutoPlay();
      }
    }

    autoPlayRafId = requestAnimationFrame(step);
  }

  function stopAutoPlay() {
    isAutoPlaying = false;
    if (autoPlayRafId) cancelAnimationFrame(autoPlayRafId);
    if (autoplayBtn) {
      autoplayBtn.innerHTML = `
        <svg class="play-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <span class="btn-text">Preview</span>
      `;
    }
  }

  /**
   * =========================================================================
   * 7. Smooth Navigation, Mobile Menu Drawer & Section Scrolling
   * =========================================================================
   */
  function initNavigation() {
    // Mobile Drawer Toggle
    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        const isClosed = mobileMenu.classList.contains('hidden');
        if (isClosed) {
          mobileMenu.classList.remove('hidden');
          if (hamburgerIcon) hamburgerIcon.textContent = 'close';
        } else {
          mobileMenu.classList.add('hidden');
          if (hamburgerIcon) hamburgerIcon.textContent = 'menu';
        }
      });
    }

    // Smooth Scrolling for all in-page anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (!targetId || targetId === '#') return;

        const targetElem = document.querySelector(targetId);
        if (targetElem) {
          e.preventDefault();

          // Close mobile menu if open
          if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
            if (hamburgerIcon) hamburgerIcon.textContent = 'menu';
          }

          // Smooth scroll to target
          targetElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /**
   * =========================================================================
   * 8. Modals System (Size Chart, Checkout, Contact Concierge)
   * =========================================================================
   */
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('hidden');
    // Check if any other modal is open before restoring scroll
    const anyOpen = document.querySelectorAll('.modal-backdrop:not(.hidden)').length > 0;
    if (!anyOpen) {
      document.body.style.overflow = '';
    }
  }

  function syncCheckoutSummary() {
    const priceEl = document.getElementById('checkout-summary-price');
    const configEl = document.getElementById('checkout-summary-config');
    const totalEl = document.getElementById('checkout-summary-total');

    const total = (productState.unitPrice * productState.qty).toFixed(2);

    if (priceEl) priceEl.textContent = `$${productState.unitPrice.toFixed(2)}`;
    if (configEl) {
      configEl.textContent = `${productState.size} • ${productState.grip} • Qty: ${productState.qty}`;
    }
    if (totalEl) totalEl.textContent = `$${total}`;
  }

  function initModals() {
    // Open Size Chart Modal
    if (sizeChartBtn) {
      sizeChartBtn.addEventListener('click', () => openModal(sizeChartModal));
    }
    const footerSizeBtn = document.getElementById('footer-size-btn');
    if (footerSizeBtn) {
      footerSizeBtn.addEventListener('click', () => openModal(sizeChartModal));
    }

    // Size selection inside modal
    document.querySelectorAll('.modal-select-size').forEach(btn => {
      btn.addEventListener('click', () => {
        const sizeNum = btn.getAttribute('data-size');
        if (sizeNum) {
          productState.size = `${sizeNum}"`;
          // Update the PDP size selector
          document.querySelectorAll('.size-btn').forEach(sb => {
            if (sb.getAttribute('data-size') === sizeNum) {
              sb.classList.add('bg-primary', 'text-on-primary', 'font-bold', 'shadow-md', 'ring-1', 'ring-primary');
              sb.classList.remove('bg-surface-container', 'text-secondary');
            } else {
              sb.classList.remove('bg-primary', 'text-on-primary', 'font-bold', 'shadow-md', 'ring-1', 'ring-primary');
              sb.classList.add('bg-surface-container', 'text-secondary');
            }
          });
          syncCheckoutSummary();
          closeModal(sizeChartModal);
          showToast('Size Selected', `Updated bat configuration to ${productState.size} BBCOR .50`, 'straighten');
        }
      });
    });

    // Open Checkout Modal
    if (expressCheckoutBtn) {
      expressCheckoutBtn.addEventListener('click', () => {
        syncCheckoutSummary();
        openModal(checkoutModal);
      });
    }
    if (navbarCartBtn) {
      navbarCartBtn.addEventListener('click', () => {
        syncCheckoutSummary();
        openModal(checkoutModal);
      });
    }

    // Open Contact Modal
    const contactTriggers = [navContactBtn, mobileContactBtn, document.getElementById('footer-contact-btn')];
    contactTriggers.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
            if (hamburgerIcon) hamburgerIcon.textContent = 'menu';
          }
          openModal(contactModal);
        });
      }
    });

    // Close buttons on all modals
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-modal');
        if (modalId) {
          closeModal(document.getElementById(modalId));
        } else {
          const parentModal = btn.closest('.modal-backdrop');
          if (parentModal) closeModal(parentModal);
        }
      });
    });

    // Close on backdrop click (outside dialog)
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeModal(backdrop);
        }
      });
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(modal => {
          closeModal(modal);
        });
      }
    });
  }

  /**
   * =========================================================================
   * 9. Precision Attributes Cards Click Handlers
   * =========================================================================
   */
  function initAttributeCards() {
    document.querySelectorAll('.attr-card').forEach(card => {
      card.addEventListener('click', () => {
        const action = card.getAttribute('data-action');
        if (action === 'grip') {
          const shopSec = document.getElementById('shop-section');
          if (shopSec) shopSec.scrollIntoView({ behavior: 'smooth' });
          // Highlight Pro Wrap grip
          const proGripBtn = Array.from(document.querySelectorAll('.grip-btn')).find(b => b.textContent.includes('Pro Wrap'));
          if (proGripBtn) proGripBtn.click();
          showToast('Ergonomic Wrap', 'Inspecting premium textured grip options in shop customizer', 'front_hand');
        } else if (action === 'ballistics') {
          const ballisticsSec = document.getElementById('ballistics-section');
          if (ballisticsSec) ballisticsSec.scrollIntoView({ behavior: 'smooth' });
        } else if (action === 'durability') {
          const anatomySec = document.getElementById('anatomy-section');
          if (anatomySec) anatomySec.scrollIntoView({ behavior: 'smooth' });
        } else if (action === 'finish') {
          const shopSec = document.getElementById('shop-section');
          if (shopSec) shopSec.scrollIntoView({ behavior: 'smooth' });
          showToast('Obsidian Gloss', 'Series 01 custom metallic and matte stealth finishes', 'auto_awesome');
        }
      });
    });
  }

  /**
   * =========================================================================
   * 10. PDP Interactions (Thumbnails, Sizes, Grips, Qty, Add to Cart)
   * =========================================================================
   */
  function initProductInteractions() {
    // Gallery Thumbnails
    const mainProductImg = document.getElementById('main-product-image');
    const thumbBtns = document.querySelectorAll('.thumb-btn');

    thumbBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        thumbBtns.forEach(b => {
          b.classList.remove('active-thumb', 'ring-2', 'ring-primary');
        });
        btn.classList.add('active-thumb', 'ring-2', 'ring-primary');
        const newSrc = btn.getAttribute('data-full-src');
        if (newSrc && mainProductImg) {
          mainProductImg.style.opacity = '0.7';
          setTimeout(() => {
            mainProductImg.src = newSrc;
            mainProductImg.style.opacity = '1';
          }, 120);
        }
      });
    });

    // Size selector
    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => {
          b.classList.remove('bg-primary', 'text-on-primary', 'font-bold', 'shadow-md', 'ring-1', 'ring-primary');
          b.classList.add('bg-surface-container', 'text-secondary');
        });
        btn.classList.add('bg-primary', 'text-on-primary', 'font-bold', 'shadow-md', 'ring-1', 'ring-primary');
        btn.classList.remove('bg-surface-container', 'text-secondary');
        const s = btn.getAttribute('data-size') || btn.textContent.trim().replace('"', '');
        productState.size = `${s}"`;
        syncCheckoutSummary();
      });
    });

    // Grip selector
    const gripBtns = document.querySelectorAll('.grip-btn');
    const selectedGripName = document.getElementById('selected-grip-name');
    gripBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        gripBtns.forEach(b => {
          b.classList.remove('bg-surface-container-high', 'text-on-surface', 'ring-1', 'ring-primary');
          b.classList.add('bg-surface-container', 'text-secondary');
        });
        btn.classList.add('bg-surface-container-high', 'text-on-surface', 'ring-1', 'ring-primary');
        btn.classList.remove('bg-surface-container', 'text-secondary');
        const gripName = btn.textContent.trim();
        productState.grip = gripName;
        if (selectedGripName) {
          selectedGripName.textContent = gripName + ' (Custom)';
        }
        syncCheckoutSummary();
      });
    });

    // Quantity counter
    const qtyMinus = document.getElementById('qty-minus');
    const qtyPlus = document.getElementById('qty-plus');
    const qtyVal = document.getElementById('qty-val');

    if (qtyMinus && qtyPlus && qtyVal) {
      qtyMinus.addEventListener('click', () => {
        if (productState.qty > 1) {
          productState.qty--;
          qtyVal.textContent = productState.qty;
          syncCheckoutSummary();
        }
      });
      qtyPlus.addEventListener('click', () => {
        if (productState.qty < 10) {
          productState.qty++;
          qtyVal.textContent = productState.qty;
          syncCheckoutSummary();
        }
      });
    }

    // Add to Cart feedback & Badge increment
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    const addCartText = document.getElementById('add-cart-text');

    if (addToCartBtn && addCartText) {
      addToCartBtn.addEventListener('click', () => {
        cartCount += productState.qty;
        if (cartCountBadge) {
          cartCountBadge.textContent = cartCount;
          cartCountBadge.classList.add('scale-125', 'bg-emerald-400');
          setTimeout(() => {
            cartCountBadge.classList.remove('scale-125', 'bg-emerald-400');
          }, 300);
        }

        const originalText = addCartText.textContent;
        addCartText.textContent = '✓ Added to Cart!';
        addToCartBtn.classList.add('bg-emerald-400', 'text-black');

        showToast(
          'Added to Cart',
          `${productState.qty}x ${productState.title} (${productState.size}, ${productState.grip}) added to your dispatch bag.`,
          'shopping_bag'
        );

        setTimeout(() => {
          addCartText.textContent = originalText;
          addToCartBtn.classList.remove('bg-emerald-400', 'text-black');
        }, 2200);
      });
    }
  }

  /**
   * =========================================================================
   * 11. Footer Secondary Action Buttons
   * =========================================================================
   */
  function initFooterActions() {
    const shippingBtn = document.getElementById('footer-shipping-btn');
    if (shippingBtn) {
      shippingBtn.addEventListener('click', () => {
        showToast('FedEx Express Delivery', 'Complimentary 2-day domestic courier shipping on all orders over $100 with signature guarantee.', 'local_shipping');
      });
    }

    const trackBtn = document.getElementById('footer-track-btn');
    if (trackBtn) {
      trackBtn.addEventListener('click', () => {
        showToast('Order Tracking Dispatch', 'Dispatch tracking portal active. Enter your order ID from confirmation email to track real-time delivery.', 'location_on');
      });
    }

    const backToTopBtn = document.getElementById('back-to-top-btn');
    if (backToTopBtn) {
      backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    document.querySelectorAll('.quick-view-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        const shopSec = document.getElementById('shop-section');
        if (shopSec) shopSec.scrollIntoView({ behavior: 'smooth' });
      });
    });

    document.querySelectorAll('.gift-card-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        openModal(contactModal);
        const topicSelect = document.getElementById('contact-topic');
        if (topicSelect) topicSelect.value = 'General Question';
      });
    });
  }

  /**
   * =========================================================================
   * 12. Form Submission & Client-Side Validation Engine
   * (Supports Formspree / Web3Forms Option A & Google Apps Script Option B)
   * =========================================================================
   */
  function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(String(email).toLowerCase().trim());
  }

  async function postFormData(endpoint, payload) {
    if (!endpoint || FORM_CONFIG.demoMode) {
      // Instant demo mode simulation (no external API setup required)
      await new Promise(r => setTimeout(r, 650));
      return { ok: true, status: 200, simulated: true };
    }

    // Determine if Google Apps Script URL
    const isGoogleAppsScript = endpoint.includes('script.google.com');

    if (isGoogleAppsScript) {
      // Google Apps Script requires text/plain or no-cors to avoid CORS 302 redirect block
      try {
        await fetch(endpoint, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        return { ok: true, status: 200 };
      } catch (err) {
        console.error('Apps Script dispatch error:', err);
        return { ok: false, error: err.message };
      }
    } else {
      // Formspree / Web3Forms standard JSON POST
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        return { ok: res.ok, status: res.status };
      } catch (err) {
        console.error('Form endpoint error:', err);
        return { ok: false, error: err.message };
      }
    }
  }

  function initForms() {
    // -----------------------------------------------------------------------
    // Form A: VIP Concierge Newsletter Signup
    // -----------------------------------------------------------------------
    const newsletterForm = document.getElementById('newsletter-form');
    const newsName = document.getElementById('newsletter-name');
    const newsEmail = document.getElementById('newsletter-email');
    const newsBtn = document.getElementById('newsletter-submit-btn');
    const newsBtnText = document.getElementById('newsletter-btn-text');
    const newsSpinner = document.getElementById('newsletter-btn-spinner');
    const newsStatus = document.getElementById('newsletter-status');

    if (newsletterForm && newsEmail) {
      newsletterForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameVal = newsName ? newsName.value.trim() : '';
        const emailVal = newsEmail.value.trim();

        if (newsName && !nameVal) {
          if (newsStatus) {
            newsStatus.className = 'text-rose-400 text-xs py-1 px-2 rounded bg-rose-950/40 border border-rose-800/40 font-medium block';
            newsStatus.textContent = 'Please provide your name.';
          }
          newsName.focus();
          return;
        }

        if (!isValidEmail(emailVal)) {
          if (newsStatus) {
            newsStatus.className = 'text-rose-400 text-xs py-1 px-2 rounded bg-rose-950/40 border border-rose-800/40 font-medium block';
            newsStatus.textContent = 'Please enter a valid email address (e.g. name@domain.com).';
          }
          newsEmail.focus();
          return;
        }

        // Loading state
        if (newsBtnText) newsBtnText.textContent = 'JOINING...';
        if (newsSpinner) newsSpinner.classList.remove('hidden');
        if (newsBtn) newsBtn.disabled = true;
        if (newsStatus) newsStatus.classList.add('hidden');

        const payload = {
          form: 'VIP Concierge Newsletter',
          name: nameVal,
          email: emailVal,
          timestamp: new Date().toISOString()
        };

        const result = await postFormData(FORM_CONFIG.newsletterEndpoint, payload);

        // Reset button
        if (newsBtnText) newsBtnText.textContent = 'JOIN';
        if (newsSpinner) newsSpinner.classList.add('hidden');
        if (newsBtn) newsBtn.disabled = false;

        if (result.ok) {
          if (newsStatus) {
            newsStatus.className = 'text-emerald-400 text-xs py-1.5 px-3 rounded bg-emerald-950/40 border border-emerald-800/40 font-medium block';
            newsStatus.textContent = '✓ Welcome to ABR BATS VIP Concierge Dispatch. Priority access confirmed!';
          }
          if (newsName) newsName.value = '';
          newsEmail.value = '';
          showToast('VIP Dispatch Confirmed', `Welcome ${nameVal || 'Athlete'}, check your inbox for priority allocation drops.`, 'mark_email_read');
        } else {
          if (newsStatus) {
            newsStatus.className = 'text-rose-400 text-xs py-1 px-2 rounded bg-rose-950/40 border border-rose-800/40 font-medium block';
            newsStatus.textContent = 'Submission failed. Please try again or reach out to concierge.';
          }
        }
      });
    }

    // -----------------------------------------------------------------------
    // Form B: Contact Concierge Modal Form
    // -----------------------------------------------------------------------
    const contactForm = document.getElementById('contact-concierge-form');
    const contactName = document.getElementById('contact-name');
    const contactEmail = document.getElementById('contact-email');
    const contactTopic = document.getElementById('contact-topic');
    const contactMsg = document.getElementById('contact-message');
    const contactBtn = document.getElementById('contact-submit-btn');
    const contactBtnText = document.getElementById('contact-btn-text');
    const contactSpinner = document.getElementById('contact-btn-spinner');
    const contactStatus = document.getElementById('contact-form-status');

    if (contactForm && contactEmail) {
      contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameVal = contactName ? contactName.value.trim() : '';
        const emailVal = contactEmail.value.trim();
        const topicVal = contactTopic ? contactTopic.value : 'General Inquiry';
        const msgVal = contactMsg ? contactMsg.value.trim() : '';

        if (!nameVal) {
          if (contactStatus) {
            contactStatus.className = 'text-rose-400 text-xs py-1.5 px-3 rounded bg-rose-950/40 border border-rose-800/40 font-medium block';
            contactStatus.textContent = 'Please enter your full name.';
          }
          if (contactName) contactName.focus();
          return;
        }

        if (!isValidEmail(emailVal)) {
          if (contactStatus) {
            contactStatus.className = 'text-rose-400 text-xs py-1.5 px-3 rounded bg-rose-950/40 border border-rose-800/40 font-medium block';
            contactStatus.textContent = 'Please enter a valid email format (e.g. coach@program.edu).';
          }
          contactEmail.focus();
          return;
        }

        if (!msgVal) {
          if (contactStatus) {
            contactStatus.className = 'text-rose-400 text-xs py-1.5 px-3 rounded bg-rose-950/40 border border-rose-800/40 font-medium block';
            contactStatus.textContent = 'Please enter your message or question.';
          }
          if (contactMsg) contactMsg.focus();
          return;
        }

        // Loading state
        if (contactBtnText) contactBtnText.textContent = 'TRANSMITTING...';
        if (contactSpinner) contactSpinner.classList.remove('hidden');
        if (contactBtn) contactBtn.disabled = true;
        if (contactStatus) contactStatus.classList.add('hidden');

        const payload = {
          form: 'Concierge Inquiry',
          name: nameVal,
          email: emailVal,
          topic: topicVal,
          message: msgVal,
          timestamp: new Date().toISOString()
        };

        const result = await postFormData(FORM_CONFIG.contactEndpoint, payload);

        // Reset button
        if (contactBtnText) contactBtnText.textContent = 'Transmit Message';
        if (contactSpinner) contactSpinner.classList.add('hidden');
        if (contactBtn) contactBtn.disabled = false;

        if (result.ok) {
          if (contactStatus) {
            contactStatus.className = 'text-emerald-400 text-xs py-2 px-3 rounded bg-emerald-950/40 border border-emerald-800/40 font-medium block';
            contactStatus.textContent = '✓ Transmission confirmed. Our Skunkworks engineering desk will respond within 24h.';
          }
          contactForm.reset();
          setTimeout(() => {
            closeModal(contactModal);
            if (contactStatus) contactStatus.classList.add('hidden');
            showToast('Message Transmitted', `Thank you ${nameVal}. Our advisory team is reviewing your dispatch.`, 'mark_chat_read');
          }, 1400);
        } else {
          if (contactStatus) {
            contactStatus.className = 'text-rose-400 text-xs py-2 px-3 rounded bg-rose-950/40 border border-rose-800/40 font-medium block';
            contactStatus.textContent = 'Transmission error. Please check connection or try again.';
          }
        }
      });
    }

    // -----------------------------------------------------------------------
    // Form C: Express Order Checkout Modal Form
    // -----------------------------------------------------------------------
    const checkoutForm = document.getElementById('express-checkout-form');
    const chkName = document.getElementById('chk-name');
    const chkEmail = document.getElementById('chk-email');
    const chkAddress = document.getElementById('chk-address');
    const chkCity = document.getElementById('chk-city');
    const chkZip = document.getElementById('chk-zip');
    const chkBtn = document.getElementById('checkout-submit-btn');
    const chkBtnText = document.getElementById('checkout-btn-text');
    const chkSpinner = document.getElementById('checkout-btn-spinner');
    const chkStatus = document.getElementById('checkout-form-status');

    if (checkoutForm && chkEmail) {
      checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameVal = chkName ? chkName.value.trim() : '';
        const emailVal = chkEmail.value.trim();
        const addrVal = chkAddress ? chkAddress.value.trim() : '';
        const cityVal = chkCity ? chkCity.value.trim() : '';
        const zipVal = chkZip ? chkZip.value.trim() : '';

        if (!nameVal || !addrVal || !cityVal || !zipVal) {
          if (chkStatus) {
            chkStatus.className = 'text-rose-400 text-xs py-2 px-3 rounded bg-rose-950/40 border border-rose-800/40 font-medium block';
            chkStatus.textContent = 'Please fill out all required shipping address fields.';
          }
          return;
        }

        if (!isValidEmail(emailVal)) {
          if (chkStatus) {
            chkStatus.className = 'text-rose-400 text-xs py-2 px-3 rounded bg-rose-950/40 border border-rose-800/40 font-medium block';
            chkStatus.textContent = 'Please enter a valid email format for your order receipt.';
          }
          chkEmail.focus();
          return;
        }

        // Loading state
        if (chkBtnText) chkBtnText.textContent = 'PROCESSING SECURE ORDER...';
        if (chkSpinner) chkSpinner.classList.remove('hidden');
        if (chkBtn) chkBtn.disabled = true;
        if (chkStatus) chkStatus.classList.add('hidden');

        const payload = {
          form: 'Express Order Checkout',
          name: nameVal,
          email: emailVal,
          address: addrVal,
          city: cityVal,
          zip: zipVal,
          product: productState.title,
          size: productState.size,
          grip: productState.grip,
          quantity: productState.qty,
          total: `$${(productState.unitPrice * productState.qty).toFixed(2)}`,
          timestamp: new Date().toISOString()
        };

        const result = await postFormData(FORM_CONFIG.checkoutEndpoint, payload);

        // Reset button
        if (chkBtnText) chkBtnText.textContent = 'Confirm & Place Order';
        if (chkSpinner) chkSpinner.classList.add('hidden');
        if (chkBtn) chkBtn.disabled = false;

        if (result.ok) {
          if (chkStatus) {
            chkStatus.className = 'text-emerald-400 text-xs py-2 px-3 rounded bg-emerald-950/40 border border-emerald-800/40 font-medium block';
            chkStatus.textContent = '✓ Payment authorized. Your order has been placed into priority fulfillment queue!';
          }

          cartCount += productState.qty;
          if (cartCountBadge) cartCountBadge.textContent = cartCount;

          checkoutForm.reset();
          setTimeout(() => {
            closeModal(checkoutModal);
            if (chkStatus) chkStatus.classList.add('hidden');
            showToast(
              'Order Confirmed!',
              `Thank you ${nameVal}! Order receipt dispatched to ${emailVal}.`,
              'verified'
            );
          }, 1400);
        } else {
          if (chkStatus) {
            chkStatus.className = 'text-rose-400 text-xs py-2 px-3 rounded bg-rose-950/40 border border-rose-800/40 font-medium block';
            chkStatus.textContent = 'Order authorization error. Please check payment information.';
          }
        }
      });
    }
  }

  /**
   * =========================================================================
   * 13. Event Listeners & Lifecycles
   * =========================================================================
   */
  window.addEventListener('scroll', onScroll, { passive: true });

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateContainerHeight();
      resizeCanvas();
    }, 40);
  });

  if (autoplayBtn) autoplayBtn.addEventListener('click', toggleAutoPlay);
  if (fitToggleBtn) fitToggleBtn.addEventListener('click', toggleViewMode);
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Cancel auto-play if user touches wheel or drag
  window.addEventListener('wheel', () => { if (isAutoPlaying) stopAutoPlay(); }, { passive: true });
  window.addEventListener('touchstart', () => { if (isAutoPlaying) stopAutoPlay(); }, { passive: true });

  /**
   * Application Entrypoint
   */
  async function init() {
    initNavigation();
    initModals();
    initAttributeCards();
    initProductInteractions();
    initFooterActions();
    initForms();

    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('skip_loader')) {
      await fetchFrameManifest();
    }
    await preloadAllFrames();
  }

  init();
})();
