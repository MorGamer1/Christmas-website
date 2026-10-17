/* =====================================================================
   FIRSIDE theme: JavaScript
   Plain browser code, no libraries. Everything is wired with event delegation,
   so it keeps working when the theme editor reloads a section.

   1. Helpers
   2. Layers (menu, search, cart drawer, filters) built on the <dialog> element
   3. Header menu on desktop
   4. Quantity buttons
   5. Cart (change, remove, refresh)
   6. Add to cart (product page, quick add, "shop the look")
   7. Product page (options, photos, sticky bar)
   8. Collection filters
   9. Search suggestions
   10. Home page: budget buttons, hero slideshow, product suggestions
   11. Start-up
   ===================================================================== */
(function () {
  'use strict';

  var config = window.Firside || {};
  var routes = config.routes || {};
  var strings = config.strings || {};
  var motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------
     1. Helpers
     --------------------------------------------------------------- */
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      var self = this;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(self, args);
      }, wait);
    };
  }

  // Replaces [name] placeholders in the strings that come from the translation files.
  function fill(text, values) {
    return String(text || '').replace(/\[(\w+)\]/g, function (match, key) {
      return values && values[key] !== undefined ? values[key] : match;
    });
  }

  function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function scrollBehavior() {
    return motion.matches ? 'auto' : 'smooth';
  }

  // Reads a message aloud for screen reader users.
  function announce(message) {
    var region = document.getElementById('LiveRegion');
    if (!region || !message) return;
    region.textContent = '';
    window.setTimeout(function () {
      region.textContent = message;
    }, 60);
  }

  // Scrolls a box just enough to show one of its children (without moving the whole page).
  function reveal(child, box) {
    var a = child.getBoundingClientRect();
    var b = box.getBoundingClientRect();
    if (a.left < b.left) box.scrollLeft -= b.left - a.left;
    else if (a.right > b.right) box.scrollLeft += a.right - b.right;
    if (a.top < b.top) box.scrollTop -= b.top - a.top;
    else if (a.bottom > b.bottom) box.scrollTop += a.bottom - b.bottom;
  }

  function setBusy(button, busy) {
    if (!button) return;
    button.classList.toggle('is-loading', busy);
    if (busy) button.setAttribute('aria-busy', 'true');
    else button.removeAttribute('aria-busy');
  }

  /* ---------------------------------------------------------------
     2. Layers: <dialog class="layer"> opened with data-open="Id", closed with data-close
     --------------------------------------------------------------- */
  function openLayer(dialog, opener) {
    if (!dialog || dialog.open) return;
    dialog._opener = opener || document.activeElement;
    dialog._closing = false;

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');

    var root = document.documentElement;
    if (!root.classList.contains('is-locked')) {
      // Measure the scrollbar before it disappears (0 on phones and with overlay scrollbars).
      root.style.setProperty('--scrollbar-gap', Math.max(0, window.innerWidth - root.clientWidth) + 'px');
      root.classList.add('is-locked');
    }
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        dialog.classList.add('is-open');
      });
    });

    var target = $('input[type="search"]', dialog) || $('h2[tabindex="-1"]', dialog);
    if (target) target.focus({ preventScroll: true });
  }

  function closeLayer(dialog) {
    if (!dialog || !dialog.open || dialog._closing) return;
    dialog._closing = true;
    dialog.classList.remove('is-open');
    var finish = function () {
      dialog._closing = false;
      if (dialog.open) dialog.close();
    };
    if (motion.matches) finish();
    else window.setTimeout(finish, 320);
  }

  document.addEventListener('click', function (event) {
    var opener = event.target.closest('[data-open]');
    if (opener) {
      var dialog = document.getElementById(opener.getAttribute('data-open'));
      if (dialog) {
        event.preventDefault();
        openLayer(dialog, opener);
      }
      return;
    }

    var closer = event.target.closest('[data-close]');
    if (closer) {
      var parent = closer.closest('dialog');
      if (parent) {
        event.preventDefault();
        closeLayer(parent);
      }
    }
  });

  // The Escape key: close with the same slide-out as the close button.
  document.addEventListener(
    'cancel',
    function (event) {
      var dialog = event.target;
      if (dialog && dialog.classList && dialog.classList.contains('layer')) {
        event.preventDefault();
        closeLayer(dialog);
      }
    },
    true
  );

  // After a layer is closed: give the page back its scroll and put the focus where it was.
  document.addEventListener(
    'close',
    function (event) {
      var dialog = event.target;
      if (!dialog || !dialog.classList || !dialog.classList.contains('layer')) return;
      dialog.classList.remove('is-open');
      if (!document.querySelector('dialog.layer[open]')) {
        document.documentElement.classList.remove('is-locked');
      }
      if (dialog.id === 'FilterDrawer') filters.dirty = false;
      var opener = dialog._opener;
      if (opener && document.contains(opener) && typeof opener.focus === 'function') {
        opener.focus({ preventScroll: true });
      }
    },
    true
  );

  /* ---------------------------------------------------------------
     3. Header menu on desktop: panels open on click and close on Escape or outside click
     --------------------------------------------------------------- */
  function closeNavPanels(except) {
    $$('[data-nav-details][open]').forEach(function (details) {
      if (details !== except && !(except && details.contains(except))) details.open = false;
    });
  }

  document.addEventListener('click', function (event) {
    $$('[data-nav-details][open]').forEach(function (details) {
      if (!details.contains(event.target)) details.open = false;
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var details = $('[data-nav-details][open]');
    if (!details) return;
    details.open = false;
    var summary = $('summary', details);
    if (summary) summary.focus();
  });

  document.addEventListener('focusin', function (event) {
    closeNavPanels(event.target);
  });

  /* ---------------------------------------------------------------
     4. Quantity buttons: [ - ] 1 [ + ]
     --------------------------------------------------------------- */
  document.addEventListener('click', function (event) {
    var step = event.target.closest('[data-qty-step]');
    if (!step) return;
    var group = step.closest('[data-qty]');
    var input = group && $('.qty__input', group);
    if (!input) return;

    var min = input.min !== '' ? Number(input.min) : 0;
    var max = input.max !== '' ? Number(input.max) : Infinity;
    var current = Number(input.value) || 0;
    var next = Math.min(max, Math.max(min, current + Number(step.getAttribute('data-qty-step'))));
    if (next === current) return;
    input.value = next;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Enter in a quantity field must not send the cart form (that would go to the checkout).
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && event.target.matches && event.target.matches('.qty__input')) {
      event.preventDefault();
      event.target.blur();
    }
  });

  /* ---------------------------------------------------------------
     5. Cart: change a quantity, remove a line, refresh the drawer / page / bag icon
     --------------------------------------------------------------- */
  var cart = {
    busy: false,
    queue: Promise.resolve(),
    pending: {}
  };

  // The sections Shopify should send back after every change, so the screen matches the real cart.
  function cartSections() {
    var ids = ['cart-icon-bubble'];
    if (document.getElementById('CartDrawer')) ids.push('cart-drawer');
    var page = $('[data-cart-section]');
    if (page && page.getAttribute('data-section-id')) ids.push(page.getAttribute('data-section-id'));
    return ids.join(',');
  }

  function renderCart(sections) {
    if (!sections) return;
    Object.keys(sections).forEach(function (id) {
      if (!sections[id]) return;
      var doc = parseHTML(sections[id]);

      if (id === 'cart-icon-bubble') {
        var bubble = document.getElementById('cart-icon-bubble');
        var wrapper = doc.body.firstElementChild;
        if (bubble && wrapper) bubble.innerHTML = wrapper.innerHTML;
        return;
      }

      var fresh = $('[data-cart-inner]', doc);
      var current;
      if (id === 'cart-drawer') {
        current = $('#CartDrawer [data-cart-inner]');
        var label = $('#CartDrawer [data-cart-count-label]');
        var freshLabel = $('[data-cart-count-label]', doc);
        if (label && freshLabel) label.textContent = freshLabel.textContent;
      } else {
        current = $('[data-cart-section] [data-cart-inner]');
      }
      if (current && fresh) current.innerHTML = fresh.innerHTML;
    });
  }

  function findLine(key) {
    return $('[data-key="' + key + '"]');
  }

  function cartBusy(isBusy) {
    cart.busy = isBusy;
    $$('[data-cart-inner]').forEach(function (inner) {
      inner.classList.toggle('is-updating', isBusy);
      if (isBusy) inner.setAttribute('aria-busy', 'true');
      else inner.removeAttribute('aria-busy');
    });
  }

  function focusAfterCartChange(key) {
    var line = key && findLine(key);
    var target = line && $('.qty__input', line);
    if (!target) {
      var scope = $('#CartDrawer[open] [data-cart-inner]') || $('[data-cart-section] [data-cart-inner]');
      target = scope && ($('.qty__input', scope) || $('a, button', scope));
    }
    if (target) target.focus({ preventScroll: true });
  }

  function changeLine(key, quantity) {
    cart.queue = cart.queue
      .then(function () {
        var line = findLine(key);
        var nameEl = line && $('.line__name', line);
        var title = nameEl ? nameEl.textContent.trim() : '';
        var errorEl = line && $('.line__error', line);
        if (errorEl) errorEl.hidden = true;
        cartBusy(true);

        return fetch(routes.cartChange, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            id: key,
            quantity: quantity,
            sections: cartSections(),
            sections_url: window.location.pathname
          })
        })
          .then(function (response) {
            return response.json();
          })
          .then(function (data) {
            if (data.status || data.errors) {
              throw new Error(typeof data.errors === 'string' ? data.errors : data.description || data.message);
            }
            renderCart(data.sections);

            var item = (data.items || []).filter(function (entry) {
              return entry.key === key;
            })[0];

            if (!item) {
              announce(fill(strings.removed, { title: title }));
            } else if (item.quantity !== quantity) {
              var fresh = findLine(key);
              var message = fill(strings.quantityError, { quantity: item.quantity });
              var freshError = fresh && $('.line__error', fresh);
              if (freshError) {
                freshError.textContent = message;
                freshError.hidden = false;
              }
              announce(message);
            } else {
              announce(strings.updated);
            }
            focusAfterCartChange(item ? key : null);
          })
          .catch(function (error) {
            var current = findLine(key);
            var currentError = current && $('.line__error', current);
            var text = (error && error.message) || strings.cartError;
            if (currentError) {
              currentError.textContent = text;
              currentError.hidden = false;
            }
            announce(text);
          })
          .then(function () {
            cartBusy(false);
          });
      })
      .catch(function () {
        cartBusy(false);
      });
    return cart.queue;
  }

  // A number typed or changed with the + / - buttons: wait a moment, so quick clicks make one request.
  document.addEventListener('change', function (event) {
    var input = event.target;
    if (!input.matches || !input.matches('.qty__input[data-line]')) return;
    var line = input.closest('[data-key]');
    if (!line) return;

    var key = line.getAttribute('data-key');
    var quantity = Math.max(0, parseInt(input.value, 10) || 0);
    input.value = quantity;

    if (cart.pending[key]) window.clearTimeout(cart.pending[key].timer);
    cart.pending[key] = {
      quantity: quantity,
      timer: window.setTimeout(function () {
        delete cart.pending[key];
        changeLine(key, quantity);
      }, 350)
    };
  });

  document.addEventListener('click', function (event) {
    var remove = event.target.closest('[data-cart-remove]');
    if (!remove) return;
    var line = remove.closest('[data-key]');
    if (!line) return;
    event.preventDefault();
    changeLine(line.getAttribute('data-key'), 0);
  });

  // Order note on the cart page
  document.addEventListener('change', function (event) {
    if (event.target.id !== 'CartNote' || !routes.cartUpdate) return;
    fetch(routes.cartUpdate, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ note: event.target.value })
    });
  });

  // Checkout button: finish any change that is still waiting before leaving the page.
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form.matches || !form.matches('[data-cart-form]')) return;
    var waiting = Object.keys(cart.pending);
    if (!waiting.length && !cart.busy) return;

    event.preventDefault();
    var submitter = event.submitter;
    waiting.forEach(function (key) {
      var entry = cart.pending[key];
      window.clearTimeout(entry.timer);
      delete cart.pending[key];
      changeLine(key, entry.quantity);
    });
    cart.queue.then(function () {
      if (typeof form.requestSubmit === 'function') form.requestSubmit(submitter);
      else form.submit();
    });
  });

  // The bag icon in the header opens the drawer (when the cart type is "Drawer").
  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-cart-open]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
    var drawer = document.getElementById('CartDrawer');
    if (config.cartType !== 'drawer' || !drawer) return;
    event.preventDefault();
    openLayer(drawer, link);
  });

  // Coming back with the Back button can show an old bag number: ask for a fresh one.
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    fetch(window.location.pathname + '?sections=cart-icon-bubble')
      .then(function (response) {
        return response.json();
      })
      .then(function (sections) {
        renderCart(sections);
      })
      .catch(function () {});
  });

  /* ---------------------------------------------------------------
     6. Add to cart
     --------------------------------------------------------------- */
  function showFormError(form, message) {
    var box = form && $('[data-form-error]', form);
    if (box) {
      box.textContent = message;
      box.hidden = false;
    }
    announce(message);
  }

  function addToCart(form, button) {
    if (!routes.cartAdd) {
      form.submit();
      return Promise.resolve();
    }
    if (button && button.classList.contains('is-loading')) return Promise.resolve();

    var errorBox = $('[data-form-error]', form);
    if (errorBox) errorBox.hidden = true;
    setBusy(button, true);

    var data = new FormData(form);
    data.set('sections', cartSections());
    data.set('sections_url', window.location.pathname);

    return fetch(routes.cartAdd, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: data
    })
      .then(function (response) {
        return response.json().then(function (json) {
          return { ok: response.ok, json: json };
        });
      })
      .then(function (result) {
        if (!result.ok || result.json.status) {
          showFormError(form, result.json.description || result.json.message || strings.cartError);
          return;
        }
        announce(fill(strings.added, { title: result.json.product_title || result.json.title || '' }));

        var drawer = document.getElementById('CartDrawer');
        if (config.cartType === 'drawer' && drawer) {
          renderCart(result.json.sections);
          openLayer(drawer, button);
        } else {
          window.location.href = routes.cart || '/cart';
        }
      })
      .catch(function () {
        showFormError(form, strings.cartError);
      })
      .then(function () {
        setBusy(button, false);
      });
  }

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form.matches || !form.matches('[data-product-form], [data-quick-add]')) return;
    event.preventDefault();

    // event.submitter also covers the sticky-bar button, which sits outside the form and points to it with form="..."
    var button = event.submitter;
    if (!button) button = $('[data-add-to-cart], .card__add', form);
    if (button && (button.disabled || button.getAttribute('aria-disabled') === 'true')) return;

    var idField = $('[name="id"]', form);
    if (!idField || !idField.value) {
      showFormError(form, strings.unavailable);
      return;
    }
    addToCart(form, button);
  });

  /* ---------------------------------------------------------------
     7. Product page: option buttons, price, photos, sticky bar
     --------------------------------------------------------------- */
  function initProduct(container) {
    if (container._ready) return;
    container._ready = true;

    var root = container.closest('.shopify-section') || document;
    var jsonEl = $('[data-product-json]', root);
    if (!jsonEl) return;
    var product;
    try {
      product = JSON.parse(jsonEl.textContent);
    } catch (error) {
      return;
    }

    var form = document.getElementById(container.getAttribute('data-form-id'));
    var idInput = form && $('[data-variant-id]', form);
    var picker = $('[data-variant-picker]', container);
    var gallery = $('[data-gallery]', container);
    var slides = gallery && $('[data-gallery-slides]', gallery);
    var thumbs = gallery ? $$('[data-thumb]', gallery) : [];
    var bar = $('[data-atc-bar]', root);
    var cta = $('[data-buy-cta]', container);

    /* ---- photos ---- */
    function slideList() {
      return slides ? $$('.gallery__slide', slides) : [];
    }

    function markThumb(index) {
      thumbs.forEach(function (thumb, position) {
        var current = position === index;
        thumb.setAttribute('aria-current', current ? 'true' : 'false');
        if (current && thumb.parentElement) reveal(thumb, thumb.parentElement);
      });
    }

    function showMedia(mediaId, instant) {
      if (!slides || !mediaId) return;
      var list = slideList();
      var index = -1;
      list.forEach(function (slide, position) {
        if (String(slide.getAttribute('data-media-id')) === String(mediaId)) index = position;
      });
      if (index < 0) return;
      slides.scrollTo({ left: index * slides.clientWidth, behavior: instant ? 'auto' : scrollBehavior() });
      markThumb(index);
    }

    if (slides) {
      var ticking = false;
      slides.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
          ticking = false;
          if (!slides.clientWidth) return;
          markThumb(Math.round(slides.scrollLeft / slides.clientWidth));
        });
      });
      thumbs.forEach(function (thumb) {
        thumb.addEventListener('click', function () {
          showMedia(thumb.getAttribute('data-thumb'));
        });
      });
    }

    /* ---- options ---- */
    function selectedOptions() {
      if (!picker) return [];
      return $$('[data-option-index]', picker).map(function (fieldset) {
        var checked = $('input:checked', fieldset);
        return checked ? checked.value : null;
      });
    }

    function findVariant(options) {
      for (var i = 0; i < product.variants.length; i++) {
        var variant = product.variants[i];
        var same = variant.options.every(function (value, position) {
          return value === options[position];
        });
        if (same) return variant;
      }
      return null;
    }

    // An option value is struck through when no available variant has it together with the rest of the choice.
    function markUnavailable(options) {
      if (!picker) return;
      $$('[data-option-index]', picker).forEach(function (fieldset, index) {
        $$('input[data-option-value]', fieldset).forEach(function (input) {
          var candidate = options.slice();
          candidate[index] = input.value;
          var buyable = product.variants.some(function (variant) {
            return (
              variant.available &&
              variant.options.every(function (value, position) {
                return value === candidate[position];
              })
            );
          });
          var label = input.closest('.opt');
          if (label) label.classList.toggle('is-unavailable', !buyable);
        });
      });
    }

    function setButtons(variant) {
      var label;
      var disabled;
      if (!variant) {
        label = strings.unavailable;
        disabled = true;
      } else if (!variant.available) {
        label = strings.soldOut;
        disabled = true;
      } else {
        label = strings.addToCart;
        disabled = false;
      }

      $$('[data-add-to-cart]', container).forEach(function (button) {
        button.disabled = disabled;
        var text = $('[data-add-label]', button);
        if (text) text.textContent = label;
      });
      $$('[data-atc-submit]', root).forEach(function (button) {
        button.disabled = disabled;
        button.textContent = label;
      });

      var badge = $('[data-availability]', container);
      if (badge) {
        var inStock = !!(variant && variant.available);
        badge.classList.toggle('badge--green', inStock);
        badge.classList.toggle('badge--red', !inStock);
        var badgeText = $('[data-availability-text]', badge);
        if (badgeText) badgeText.textContent = inStock ? strings.inStock : strings.soldOut;
      }

      var express = $('[data-express]', container);
      if (express) express.hidden = disabled;
    }

    function update(changed) {
      var options = selectedOptions();
      markUnavailable(options);

      if (picker) {
        $$('[data-option-index]', picker).forEach(function (fieldset, index) {
          var labelEl = $('[data-option-label]', fieldset);
          if (labelEl && options[index] !== null) labelEl.textContent = options[index];
        });
      }

      var variant = findVariant(options);
      setButtons(variant);
      if (!variant) return;

      if (idInput && String(idInput.value) !== String(variant.id)) {
        idInput.value = variant.id;
        idInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      var priceBox = $('[data-price]', container);
      if (priceBox && variant.priceHtml) priceBox.innerHTML = variant.priceHtml;
      var barPrice = $('[data-atc-price]', root);
      if (barPrice && variant.priceHtml) barPrice.innerHTML = variant.priceHtml;
      var barVariant = $('[data-atc-variant]', root);
      if (barVariant) barVariant.textContent = variant.title;

      if (changed) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState(null, '', url.toString());
        if (variant.mediaId) showMedia(variant.mediaId);
      }
    }

    if (picker) {
      picker.addEventListener('change', function (event) {
        if (event.target.matches('[data-option-value]')) update(true);
      });
      update(false);
      if (new URL(window.location.href).searchParams.get('variant') && product.selectedVariantId) {
        var selected = product.variants.filter(function (variant) {
          return variant.id === product.selectedVariantId;
        })[0];
        if (selected && selected.mediaId) showMedia(selected.mediaId, true);
      }
    }

    /* ---- sticky bar for phones ---- */
    if (bar && cta) {
      // Shown once the main button has scrolled out of sight above the screen. A scroll listener (not an
      // IntersectionObserver) because that one misses jumps, such as the Home key going straight back to the top.
      var barTicking = false;
      var checkBar = function () {
        barTicking = false;
        bar.classList.toggle('is-visible', cta.getBoundingClientRect().bottom < 0);
      };
      var onScroll = function () {
        if (barTicking) return;
        barTicking = true;
        window.requestAnimationFrame(checkBar);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', checkBar);
      checkBar();

      // In the theme editor the section is replaced after every change: let go of the old listeners.
      productCleanups.push({
        node: container,
        run: function () {
          window.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', checkBar);
        }
      });
    }
  }

  var productCleanups = [];

  function cleanupProducts(root) {
    productCleanups = productCleanups.filter(function (entry) {
      if (root.contains(entry.node) || !document.contains(entry.node)) {
        entry.run();
        return false;
      }
      return true;
    });
  }

  /* ---------------------------------------------------------------
     8. Collection filters: update the grid without reloading the page
     --------------------------------------------------------------- */
  var filters = { controller: null, dirty: false, used: false };

  function numberFromField(value) {
    return String(value).replace(/\s/g, '').replace(',', '.');
  }

  function filterParams(form) {
    var params = new URLSearchParams();
    new FormData(form).forEach(function (value, name) {
      var text = String(value).trim();
      if (text === '') return;
      if (/\.(gte|lte)$/.test(name)) text = numberFromField(text);
      params.append(name, text);
    });
    return params;
  }

  function applyFilterResponse(doc, syncForm) {
    var fresh;
    var current;

    ['[data-products-grid]', '[data-active-filters]'].forEach(function (selector) {
      current = $(selector);
      fresh = $(selector, doc);
      if (current && fresh) current.innerHTML = fresh.innerHTML;
    });

    current = $('[data-products-count]');
    fresh = $('[data-products-count]', doc);
    if (current && fresh) {
      current.textContent = fresh.textContent;
      current.setAttribute('data-count', fresh.getAttribute('data-count') || '');
    }

    current = $('[data-open="FilterDrawer"]');
    fresh = $('[data-open="FilterDrawer"]', doc);
    if (current && fresh) current.innerHTML = fresh.innerHTML;

    var form = $('[data-filters-form]');
    if (!form) return;

    var apply = $('[data-apply]', form);
    var freshApply = $('[data-apply]', doc);
    if (apply && freshApply) apply.textContent = freshApply.textContent.trim();

    if (syncForm) {
      var body = $('.drawer__body', form);
      var freshBody = $('[data-filters-form] .drawer__body', doc);
      if (body && freshBody) body.innerHTML = freshBody.innerHTML;
      return;
    }

    // keep what the shopper is doing, just refresh the counts next to each value
    $$('[data-filter-count]', form).forEach(function (countEl) {
      var id = countEl.getAttribute('data-filter-count');
      var freshCount = doc.querySelector('[data-filter-count="' + id + '"]');
      if (freshCount) countEl.textContent = freshCount.textContent;
      var input = document.getElementById(id);
      var freshInput = doc.getElementById(id);
      if (input && freshInput) {
        input.disabled = freshInput.disabled;
        var label = input.closest('.radio');
        if (label) label.classList.toggle('is-disabled', freshInput.disabled);
      }
    });
  }

  function loadFilters(params, options) {
    options = options || {};
    var form = $('[data-filters-form]');
    if (!form) {
      window.location.search = params.toString();
      return Promise.resolve();
    }

    var action = form.getAttribute('action') || window.location.pathname;
    var query = params.toString();
    var requestUrl =
      action + '?' + (query ? query + '&' : '') + 'section_id=' + encodeURIComponent(form.getAttribute('data-section-id'));

    if (filters.controller) filters.controller.abort();
    filters.controller = typeof AbortController === 'function' ? new AbortController() : null;

    var grid = $('[data-products-grid]');
    if (grid) {
      grid.classList.add('is-updating');
      grid.setAttribute('aria-busy', 'true');
    }

    var pageUrl = action + (query ? '?' + query : '');
    if (options.history === 'push') window.history.pushState({ filters: true }, '', pageUrl);
    else if (options.history === 'replace') window.history.replaceState({ filters: true }, '', pageUrl);
    filters.used = true;

    return fetch(requestUrl, filters.controller ? { signal: filters.controller.signal } : undefined)
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        applyFilterResponse(parseHTML(html), !!options.syncForm);
        var count = $('[data-products-count]');
        if (count) announce(count.textContent);
      })
      .catch(function (error) {
        if (error && error.name === 'AbortError') return;
        window.location.href = pageUrl;
      })
      .then(function () {
        var current = $('[data-products-grid]');
        if (current) {
          current.classList.remove('is-updating');
          current.removeAttribute('aria-busy');
        }
      });
  }

  function filtersChanged(form, andClose) {
    var params = filterParams(form);
    var mode = filters.dirty ? 'replace' : 'push';
    filters.dirty = true;
    var request = loadFilters(params, { history: mode });
    if (andClose) {
      request.then(function () {
        closeLayer(document.getElementById('FilterDrawer'));
      });
    }
  }

  var liveFilters = debounce(function (form) {
    filtersChanged(form, false);
  }, 400);

  document.addEventListener('change', function (event) {
    var form = event.target.closest && event.target.closest('[data-filters-form]');
    if (form) liveFilters(form);
  });

  document.addEventListener('input', function (event) {
    var field = event.target;
    if (!field.matches || !field.matches('input[type="text"]')) return;
    var form = field.closest('[data-filters-form]');
    if (form) liveFilters(form);
  });

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form.matches || !form.matches('[data-filters-form]')) return;
    event.preventDefault();
    filtersChanged(form, true);
  });

  // Removing a filter (the small tags above the grid, or "Clear all")
  document.addEventListener('click', function (event) {
    var link = event.target.closest('[data-filter-remove]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    var params = new URL(link.href, window.location.href).searchParams;
    params.delete('page');
    filters.dirty = false;
    loadFilters(params, { history: 'push', syncForm: true });
  });

  window.addEventListener('popstate', function (event) {
    if (filters.used || (event.state && event.state.filters)) window.location.reload();
  });

  /* ---------------------------------------------------------------
     9. Search suggestions while typing
     --------------------------------------------------------------- */
  function initSearch(form) {
    if (form._ready || !routes.predictiveSearch) return;
    form._ready = true;

    var input = $('input[type="search"]', form);
    var results = document.getElementById('SearchResults');
    if (!input || !results) return;

    var initialHTML = results.innerHTML;
    var cache = {};
    var controller = null;

    function showDefault() {
      results.innerHTML = initialHTML;
    }

    function search(term) {
      if (cache[term]) {
        results.innerHTML = cache[term];
        return;
      }
      if (controller) controller.abort();
      controller = typeof AbortController === 'function' ? new AbortController() : null;

      var url =
        routes.predictiveSearch +
        '?q=' +
        encodeURIComponent(term) +
        '&section_id=predictive-search' +
        '&resources[type]=product,collection,query,page,article' +
        '&resources[limit]=6&resources[limit_scope]=each';

      fetch(url, controller ? { signal: controller.signal } : undefined)
        .then(function (response) {
          if (!response.ok) throw new Error(String(response.status));
          return response.text();
        })
        .then(function (html) {
          var box = $('[data-predictive-results]', parseHTML(html));
          if (!box) return;
          cache[term] = box.innerHTML;
          if (input.value.trim() === term) results.innerHTML = box.innerHTML;
        })
        .catch(function () {});
    }

    var onType = debounce(function () {
      var term = input.value.trim();
      if (term.length < 2) {
        showDefault();
        return;
      }
      search(term);
    }, 250);

    input.addEventListener('input', onType);
    form.addEventListener('reset', showDefault);
  }

  /* ---------------------------------------------------------------
     10. Home page: budget buttons, hero slideshow, product suggestions
     --------------------------------------------------------------- */
  document.addEventListener('click', function (event) {
    var tab = event.target.closest('[data-budget-tab]');
    if (!tab || event.metaKey || event.ctrlKey || event.shiftKey) return;
    var wrap = tab.closest('[data-budget]');
    if (!wrap) return;
    event.preventDefault();

    var id = tab.getAttribute('data-budget-tab');
    $$('[data-budget-tab]', wrap).forEach(function (other) {
      if (other === tab) other.setAttribute('aria-current', 'true');
      else other.removeAttribute('aria-current');
    });
    $$('[data-budget-panel]', wrap).forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-budget-panel') !== id;
      if (!panel.hidden) {
        var all = $('[data-budget-all]', wrap);
        if (all && panel.getAttribute('data-url')) all.setAttribute('href', panel.getAttribute('data-url'));
      }
    });
  });

  /* Hero slideshow (sections/image-banner.liquid).
     The frame stays, the slides inside it fade. It follows the WAI-ARIA carousel pattern, with these rules:
     - the pause button is first in the page order (it is hidden until it has keyboard focus); previous, dots and next
       are in a row under the hero
     - the slides change by themselves, and carry on after a visitor uses an arrow or a dot or swipes
     - they wait while a mouse is over the text, the buttons or the shop-the-look card, while the hero is off screen and
       while the browser tab is hidden. A wait is only a pause: the loading bar and the countdown carry on from the
       same point afterwards
     - keyboard focus entering the hero stops them until the visitor starts them again with the pause button, and a
       visitor's device that asks for less motion never starts them
     - screen readers read a new slide aloud only when slides are not changing by themselves */
  function initHero(section) {
    if (section._hero) return;
    var slides = $$('[data-hero-slide]', section);
    var pics = $$('[data-hero-pic]', section);
    var dots = $$('[data-hero-dot]', section);
    var stack = $('[data-hero-slides]', section);
    var toggle = $('[data-hero-toggle]', section);
    var toggleText = toggle ? $('[data-hero-toggle-text]', toggle) : null;
    var count = slides.length;
    if (count < 2 || pics.length !== count || dots.length !== count) return;

    var editor = document.documentElement.classList.contains('shopify-design-mode');
    var autoplay = section.getAttribute('data-autoplay') === 'true';
    var interval = (Number(section.getAttribute('data-interval')) || 7) * 1000;
    var zones = '.hero__copy, .look'; // pointing at these holds the slides: the text and buttons, the shop-the-look card
    var index = 0;
    slides.forEach(function (slide, i) {
      if (slide.classList.contains('is-active')) index = i;
    });
    var stopped = autoplay && (motion.matches || editor); // stopped by keyboard focus, the pause button, the visitor's device or the theme editor
    var hovering = false; // a mouse is over the text, the buttons or the shop-the-look card
    var visible = true; // the hero is on screen
    var wasRunning = false;
    var timer = 0;
    var left = interval; // how much of the showing time of this slide is still to come (milliseconds)
    var since = 0; // when the countdown last started or went on
    var touch = null;
    var observer = null;
    function clock() {
      return window.performance && window.performance.now ? window.performance.now() : Date.now();
    }

    function running() {
      return autoplay && !stopped && !hovering && visible && !document.hidden;
    }

    // Brings classes, labels, the live region and the countdown in line with the state above.
    // restart: give the slide its whole time again (after a slide change or a press on the pause button).
    // Without it a wait is only a pause: the time that is left carries on afterwards.
    function sync(restart) {
      var on = running();
      if (wasRunning) left = Math.max(0, left - (clock() - since));
      if (restart) left = interval;
      window.clearTimeout(timer);
      if (on) {
        since = clock();
        timer = window.setTimeout(function () {
          go(index + 1);
        }, left);
      }
      wasRunning = on;
      section.classList.toggle('is-playing', on);
      section.classList.toggle('is-stopped', autoplay && stopped);
      section.classList.toggle('is-armed', autoplay && !stopped); // the loading bar belongs to a slideshow that is not stopped
      if (stack) stack.setAttribute('aria-live', autoplay && !stopped ? 'off' : 'polite');
      if (toggle) {
        var label = toggle.getAttribute(stopped ? 'data-label-play' : 'data-label-pause') || '';
        toggle.setAttribute('aria-label', label);
        if (toggleText) toggleText.textContent = label; // the words shown while the button has keyboard focus
      }
    }

    function go(to) {
      to = (to + count) % count;
      if (to === index) return;
      slides[index].classList.remove('is-active');
      pics[index].classList.remove('is-active');
      dots[index].removeAttribute('aria-current');
      index = to;
      slides[index].classList.add('is-active');
      pics[index].classList.add('is-active');
      dots[index].setAttribute('aria-current', 'true');
      sync(true); // a new slide gets its whole time
    }

    // The visitor is using the slideshow with the keyboard (or picked a slide in the theme editor): it stops, and stays
    // stopped until they press the pause button. A mouse click or a swipe does not stop it.
    function takeOver() {
      if (autoplay && !stopped) {
        stopped = true;
        sync();
      }
    }

    section.addEventListener('click', function (event) {
      var button = event.target.closest('button');
      if (!button || !section.contains(button)) return;
      if (button.hasAttribute('data-hero-toggle')) {
        stopped = !stopped;
        sync(true);
      } else if (button.hasAttribute('data-hero-next')) {
        go(index + 1);
      } else if (button.hasAttribute('data-hero-prev')) {
        go(index - 1);
      } else if (button.hasAttribute('data-hero-dot')) {
        go(Number(button.getAttribute('data-hero-dot')));
      }
    });

    // Keyboard focus entering the hero stops it (a mouse click on a control does not count)
    section.addEventListener('focusin', function (event) {
      var keyboard = true;
      try {
        keyboard = event.target.matches(':focus-visible');
      } catch (error) {
        keyboard = true;
      }
      if (keyboard) takeOver();
    });

    // Left and right arrow keys move between the dots
    section.addEventListener('keydown', function (event) {
      var dot = event.target.closest && event.target.closest('[data-hero-dot]');
      var step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!dot || !step) return;
      event.preventDefault();
      var to = (Number(dot.getAttribute('data-hero-dot')) + step + count) % count;
      dots[to].focus();
      takeOver();
      go(to);
    });

    // A mouse (or pen) over the text, the buttons or the shop-the-look card holds the slides. Over the arrows, the dots
    // and the picture it does not. Moving away lets them carry on from where they were.
    function onPointer(event) {
      if (event.pointerType === 'touch') return;
      var zone = event.target.closest ? event.target.closest(zones) : null;
      var over = !!zone && section.contains(zone);
      if (over !== hovering) {
        hovering = over;
        sync();
      }
    }
    section.addEventListener('pointerover', onPointer);
    section.addEventListener('pointermove', onPointer);
    section.addEventListener('pointerleave', function (event) {
      if (event.pointerType === 'touch' || !hovering) return;
      hovering = false;
      sync();
    });

    // Swipe sideways on a touch screen (the buttons stay for everyone else)
    section.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' || !event.isPrimary) return;
      touch = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    section.addEventListener('pointerup', function (event) {
      if (!touch || event.pointerId !== touch.id) return;
      var dx = event.clientX - touch.x;
      var dy = event.clientY - touch.y;
      touch = null;
      if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(index + (dx < 0 ? 1 : -1));
    });
    section.addEventListener('pointercancel', function () {
      touch = null;
    });

    // The theme editor: choosing a slide in the sidebar shows it, and the slideshow stays still
    section.addEventListener('shopify:block:select', function (event) {
      var at = slides.indexOf(event.target);
      if (at < 0) return;
      takeOver();
      go(at);
    });

    function onVisibility() {
      sync();
    }
    function onMotion() {
      if (autoplay && motion.matches) stopped = true;
      sync();
    }
    document.addEventListener('visibilitychange', onVisibility);
    if (motion.addEventListener) motion.addEventListener('change', onMotion);

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        function (entries) {
          visible = entries[entries.length - 1].isIntersecting;
          sync();
        },
        { threshold: 0.15 }
      );
      observer.observe(section);
    }

    section._hero = {
      destroy: function () {
        window.clearTimeout(timer);
        if (observer) observer.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        if (motion.removeEventListener) motion.removeEventListener('change', onMotion);
        section._hero = null;
      }
    };

    // A mouse that already rests on the text when the page loads holds the slides from the start
    if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
      try {
        hovering = !!section.querySelector('.hero__copy:hover, .look:hover');
      } catch (error) {
        hovering = false;
      }
    }
    sync(true);
  }

  function initRecommendations(box) {
    if (box._ready) return;
    box._ready = true;
    var url = box.getAttribute('data-url');
    if (!url || box.querySelector('.cards')) return;

    function load() {
      fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error(String(response.status));
          return response.text();
        })
        .then(function (html) {
          var fresh = $('[data-product-recommendations]', parseHTML(html));
          if (fresh && fresh.innerHTML.trim()) box.innerHTML = fresh.innerHTML;
        })
        .catch(function () {});
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(
        function (entries, self) {
          if (entries[0].isIntersecting) {
            self.disconnect();
            load();
          }
        },
        { rootMargin: '400px 0px' }
      );
      observer.observe(box);
    } else {
      load();
    }
  }

  /* ---------------------------------------------------------------
     Language and country selectors: choosing an option sends its form
     --------------------------------------------------------------- */
  document.addEventListener('change', function (event) {
    var select = event.target;
    if (select && select.matches && select.matches('[data-localization-select]') && select.form) {
      select.form.submit();
    }
  });

  /* ---------------------------------------------------------------
     11. Start-up
     --------------------------------------------------------------- */
  function init(root) {
    root = root || document;
    $$('[data-product-section]', root).forEach(initProduct);
    $$('[data-predictive-search]', root).forEach(initSearch);
    $$('[data-product-recommendations]', root).forEach(initRecommendations);
    $$('[data-hero]', root).forEach(initHero);
    $$('[data-password-enter]', root).forEach(function (details) {
      if ($('[data-kind="error"]', details)) details.open = true;
    });
  }

  init(document);

  // The theme editor reloads a section after every change: set that section up again.
  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
  });
  document.addEventListener('shopify:section:unload', function (event) {
    cleanupProducts(event.target);
    $$('[data-hero]', event.target).forEach(function (section) {
      if (section._hero) section._hero.destroy();
    });
  });
})();
