/**
 * Apple-grade Scroll-Driven Image Sequence
 * ZeroCollision Showcase
 */

(function () {
  'use strict';

  // Configuration Constants
  const TOTAL_FRAMES = 192;
  const FRAME_PREFIX = 'frames/frame_';
  const FRAME_EXTENSION = '.webp';

  // DOM Elements
  const canvas = document.getElementById('product-canvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d');
  const scrollContainer = document.getElementById('scroll-container');
  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderPercent = document.getElementById('loader-percent');
  const loaderSpinner = document.getElementById('loader-spinner');

  // Narrative Card Overlays
  const overlay1 = document.getElementById('overlay-1');
  const overlay2 = document.getElementById('overlay-2');
  const overlay3 = document.getElementById('overlay-3');
  const overlay4 = document.getElementById('overlay-4');

  // State
  const images = [];
  let isCanvasSized = false;
  let currentRenderedFrame = -1;
  let requestedFrameIndex = 0;
  let rafId = null;
  let resizeRafId = null;

  /**
   * Generates formatted file path for a frame index (e.g. frames/frame_000000.webp)
   */
  function getFramePath(index) {
    const padded = String(index).padStart(6, '0');
    return `${FRAME_PREFIX}${padded}${FRAME_EXTENSION}`;
  }

  /**
   * Preload all 192 images into the images array.
   * Updates loading screen progress and hides only when all images are loaded.
   */
  function preloadImages() {
    return new Promise((resolve) => {
      let loadedCount = 0;
      const circumference = 2 * Math.PI * 17; // ~106.81px for r=17 SVG circle

      function onImageComplete(index, img) {
        // Set canvas internal dimensions once the first loaded image's dimensions are ready
        if (!isCanvasSized && (index === 0 || (img.naturalWidth && img.naturalHeight))) {
          canvas.width = img.naturalWidth || 1920;
          canvas.height = img.naturalHeight || 1080;
          isCanvasSized = true;
          handleResize();
        }

        loadedCount++;
        const percent = Math.min(100, Math.round((loadedCount / TOTAL_FRAMES) * 100));

        // Update loading UI
        if (loaderBar) loaderBar.style.width = `${percent}%`;
        if (loaderPercent) loaderPercent.textContent = `${percent}%`;
        if (loaderSpinner) {
          const dashoffset = circumference - (circumference * percent) / 100;
          loaderSpinner.style.strokeDashoffset = dashoffset;
        }

        // Check if all images have finished loading
        if (loadedCount === TOTAL_FRAMES) {
          // Guarantee canvas internal width & height match image 0 natural dimensions
          if (images[0] && images[0].naturalWidth) {
            canvas.width = images[0].naturalWidth;
            canvas.height = images[0].naturalHeight;
            handleResize();
          }
          resolve();
        }
      }

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const img = new Image();
        img.onload = () => {
          if ('decode' in img) {
            img.decode()
              .then(() => onImageComplete(i, img))
              .catch(() => onImageComplete(i, img));
          } else {
            onImageComplete(i, img);
          }
        };
        img.onerror = () => {
          console.warn(`Failed to load: ${getFramePath(i)}`);
          onImageComplete(i, img);
        };
        img.src = getFramePath(i);
        images.push(img);
      }
    });
  }

  /**
   * Draws a specific frame index onto the canvas.
   */
  function drawFrame(index) {
    const img = images[index];
    if (!img) return;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    currentRenderedFrame = index;
  }

  /**
   * requestAnimationFrame loop worker:
   * Only redraws if the requested frame index is different from current.
   */
  function render() {
    rafId = null;
    if (requestedFrameIndex !== currentRenderedFrame) {
      drawFrame(requestedFrameIndex);
    }
  }

  /**
   * Schedules a canvas redraw via requestAnimationFrame if the frame index changed.
   */
  function scheduleRender(frameIndex) {
    if (frameIndex === currentRenderedFrame && frameIndex === requestedFrameIndex) {
      return;
    }
    requestedFrameIndex = frameIndex;
    if (rafId === null) {
      rafId = requestAnimationFrame(render);
    }
  }

  /**
   * Adjusts canvas CSS display size while strictly preserving internal resolution (1920x1080).
   */
  function handleResize() {
    if (!canvas.width || !canvas.height) return;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const canvasAspect = canvas.width / canvas.height;
    const viewportAspect = viewportW / viewportH;

    let displayWidth;
    let displayHeight;

    if (viewportAspect > canvasAspect) {
      // Screen is wider than 16:9 - fit to viewport height
      displayHeight = viewportH;
      displayWidth = viewportH * canvasAspect;
    } else {
      // Screen is narrower than 16:9 - fit to viewport width
      displayWidth = viewportW;
      displayHeight = viewportW / canvasAspect;
    }

    canvas.style.width = `${Math.round(displayWidth)}px`;
    canvas.style.height = `${Math.round(displayHeight)}px`;

    // Re-draw current frame on resize to prevent flicker
    if (currentRenderedFrame >= 0 && images[currentRenderedFrame]) {
      drawFrame(currentRenderedFrame);
    }
  }

  /**
   * Synchronizes narrative storytelling cards with scroll progress.
   */
  function updateNarrativeOverlays(progress) {
    if (overlay1) overlay1.classList.toggle('active', progress >= 0.0 && progress <= 0.18);
    if (overlay2) overlay2.classList.toggle('active', progress >= 0.24 && progress <= 0.44);
    if (overlay3) overlay3.classList.toggle('active', progress >= 0.50 && progress <= 0.72);
    if (overlay4) overlay4.classList.toggle('active', progress >= 0.78 && progress <= 1.0);
  }


  /**
   * Scroll event handler:
   * Calculates normalized progress (0 to 1) through the 500vh tall container,
   * maps it to frame index (0 to 191), and triggers redraw.
   */
  function handleScroll() {
    if (!scrollContainer) return;

    const rect = scrollContainer.getBoundingClientRect();
    const maxScroll = scrollContainer.offsetHeight - window.innerHeight;

    // Current scrolled distance inside the scroll-container
    const currentScroll = -rect.top;

    // Calculate progress clamped between 0 and 1
    const rawProgress = maxScroll > 0 ? currentScroll / maxScroll : 0;
    const progress = Math.max(0, Math.min(1, rawProgress));

    // Map progress to frame index (0 to 191)
    const frameIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.floor(progress * TOTAL_FRAMES)));

    // Trigger canvas draw only if frame changed
    scheduleRender(frameIndex);

    // Update narrative overlays
    updateNarrativeOverlays(progress);
  }

  /**
   * Hides the loading screen with smooth fade transition once all images are ready.
   */
  function dismissLoader() {
    if (!loader) return;
    loader.classList.add('hidden');
    setTimeout(() => {
      loader.style.display = 'none';
    }, 800);
  }

  /**
   * Smoothly navigates to target section on nav link click, factoring in fixed headers.
   */
  function setupSmoothNavigation() {
    const navAnchors = document.querySelectorAll('a[href^="#"]');
    navAnchors.forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (!targetId || targetId === '#') return;

        const targetEl = document.querySelector(targetId);
        if (!targetEl) return;

        e.preventDefault();

        if (targetId === '#overview') {
          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
          history.pushState(null, '', targetId);
          return;
        }

        // Account for 48px global nav + 52px product subnav + padding
        const navOffset = 108;
        const elementPosition = targetEl.getBoundingClientRect().top + window.pageYOffset;
        const targetPosition = Math.max(0, elementPosition - navOffset);

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });

        history.pushState(null, '', targetId);

        // Highlight card for visual confirmation
        if (targetEl.classList.contains('bento-card')) {
          targetEl.classList.remove('nav-highlight');
          void targetEl.offsetWidth; // force reflow
          targetEl.classList.add('nav-highlight');
          setTimeout(() => targetEl.classList.remove('nav-highlight'), 1800);
        }
      });
    });

    // Handle direct hash navigation on initial page load
    if (window.location.hash && window.location.hash !== '#') {
      const initialTarget = document.querySelector(window.location.hash);
      if (initialTarget) {
        setTimeout(() => {
          const navOffset = 108;
          const elementPosition = initialTarget.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({
            top: Math.max(0, elementPosition - navOffset),
            behavior: 'smooth'
          });
        }, 500);
      }
    }
  }

  /**
   * Initializes the application.
   */
  async function init() {
    // 1. Attach window resize listener
    window.addEventListener('resize', () => {
      if (resizeRafId) cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(handleResize);
    });

    // 2. Attach scroll listener
    window.addEventListener('scroll', handleScroll, { passive: true });

    // 3. Setup interactive navigation links
    setupSmoothNavigation();

    // 4. Preload all 192 images
    await preloadImages();

    // 5. Initial layout calculation and render first frame (frame 0)
    handleResize();
    scheduleRender(0);
    handleScroll();

    // 6. Brief gentle delay for visual polish, then dismiss loading screen
    setTimeout(dismissLoader, 300);
  }

  // Start when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
