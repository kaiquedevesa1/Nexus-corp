import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./navbar.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * Navbar desktop com links visiveis e drawer acessivel no mobile.
 *
 * O que sobra para o JS e o que depende do scroll:
 *   - o rotulo da esquerda dizendo em que secao a pagina esta;
 *   - a marcacao do link correspondente;
 *   - a barra compactando ao sair do topo;
 *   - o fio de luz varrendo a base.
 *   - abertura, foco e fechamento do menu hambúrguer.
 *
 * @param {Element} nav  raiz .nav
 */
export function createNavbar(nav) {
  if (!nav) return { dispose() {} };

  const scan = nav.querySelector(".nav__scan i");
  const where = nav.querySelector(".nav__where span");
  const links = gsap.utils.toArray(".nav__link", nav);
  const mobileLinks = gsap.utils.toArray(".nav__mobile-link", nav);
  const navigationLinks = [...links, ...mobileLinks];
  const toggle = nav.querySelector(".nav__toggle");
  const panel = nav.querySelector(".nav__mobile-panel");
  const backdrop = nav.querySelector(".nav__backdrop");
  const mobileCta = nav.querySelector(".nav__mobile-cta");
  const plate = nav.querySelector(".nav__plate");

  if (!links.length) return { dispose() {} };

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const triggers = [];
  const cleanups = [];

  const on = (target, event, handler, options) => {
    if (!target) return;
    target.addEventListener(event, handler, options);
    cleanups.push(() => target.removeEventListener(event, handler, options));
  };

  /* --- menu mobile ------------------------------------------------------ */
  let menuOpen = false;

  const setMenuOpen = (open, { restoreFocus = false } = {}) => {
    if (!toggle || !panel) return;
    menuOpen = Boolean(open);
    nav.classList.toggle("is-menu-open", menuOpen);
    document.documentElement.classList.toggle("nav-menu-open", menuOpen);
    toggle.setAttribute("aria-expanded", String(menuOpen));
    toggle.setAttribute("aria-label", menuOpen ? "Fechar menu" : "Abrir menu");
    panel.setAttribute("aria-hidden", String(!menuOpen));
    panel.toggleAttribute("inert", !menuOpen);

    if (menuOpen) {
      requestAnimationFrame(() => {
        if (menuOpen) mobileLinks[0]?.focus({ preventScroll: true });
      });
    } else if (restoreFocus) {
      toggle.focus({ preventScroll: true });
    }
  };

  on(toggle, "click", () => setMenuOpen(!menuOpen, { restoreFocus: menuOpen }));
  on(backdrop, "click", () => setMenuOpen(false, { restoreFocus: true }));

  [...mobileLinks, mobileCta].filter(Boolean).forEach((item) => {
    on(item, "click", () => setMenuOpen(false, { restoreFocus: true }));
  });
  on(plate, "click", () => setMenuOpen(false));

  const onMenuKeydown = (event) => {
    if (!menuOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false, { restoreFocus: true });
      return;
    }

    if (event.key !== "Tab" || !panel || !toggle) return;
    const focusables = [
      toggle,
      ...panel.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]'),
    ].filter((element) => !element.hasAttribute("inert"));
    const first = focusables[0];
    const last = focusables.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  on(document, "keydown", onMenuKeydown);

  const mobileMedia = matchMedia("(max-width: 900px)");
  const onBreakpointChange = (event) => {
    if (!event.matches) setMenuOpen(false);
  };
  on(mobileMedia, "change", onBreakpointChange);

  /* --- indicador de secao + link ativo ---------------------------------- */
  const defaultLabel = where?.textContent ?? "";

  const markCurrent = (href, label) => {
    navigationLinks.forEach((item) => {
      const current = item.getAttribute("href") === href;
      item.classList.toggle("is-current", current);
      if (current) item.setAttribute("aria-current", "location");
      else item.removeAttribute("aria-current");
    });
    if (where) where.textContent = label || defaultLabel;
  };

  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#") || href.length < 2) return;

    const section = document.querySelector(href);
    if (!section) return;

    triggers.push(
      ScrollTrigger.create({
        trigger: section,
        start: "top 45%",
        end: "bottom 45%",
        onToggle: (self) => {
          if (!self.isActive) return;
          markCurrent(href, link.dataset.label);
        },
      }),
    );
  });

  /* Voltando ao topo nenhuma secao esta ativa — o rotulo precisa de um estado
     de repouso, senao fica preso no ultimo valor. */
  triggers.push(
    ScrollTrigger.create({
      trigger: document.documentElement,
      start: "top top",
      end: "+=200",
      onEnterBack: () => {
        navigationLinks.forEach((other) =>
          other.classList.remove("is-current"),
        );
        navigationLinks.forEach((other) => other.removeAttribute("aria-current"));
        if (where) where.textContent = defaultLabel;
      },
    }),
  );

  /* --- barra compacta ao rolar ------------------------------------------ */
  let compact = false;
  triggers.push(
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        const next = self.scroll() > 40;
        if (next === compact) return;
        compact = next;
        nav.classList.toggle("is-scrolled", next);
      },
    }),
  );

  /* --- varredura de luz na base da barra -------------------------------- */
  let scanTween = null;
  if (scan && !reducedMotion) {
    scanTween = gsap.fromTo(
      scan,
      { xPercent: -120 },
      {
        xPercent: 620,
        duration: 4.5,
        ease: "none",
        repeat: -1,
        repeatDelay: 2.4,
      },
    );
  }

  return {
    dispose() {
      setMenuOpen(false);
      scanTween?.kill();
      triggers.forEach((trigger) => trigger.kill());
      cleanups.forEach((cleanup) => cleanup());
      navigationLinks.forEach((link) => {
        link.classList.remove("is-current");
        link.removeAttribute("aria-current");
      });
      nav.classList.remove("is-scrolled", "is-menu-open");
      document.documentElement.classList.remove("nav-menu-open");
    },
  };
}
