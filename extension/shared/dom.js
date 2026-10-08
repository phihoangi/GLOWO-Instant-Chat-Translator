(function () {
  const ownUI = '.chat-translator-incoming, .chat-translator-preview, .chat-translator-diagnostic';

  function shadowRoot(element) {
    if (!(element instanceof Element) || element.matches(ownUI)) return null;
    if (element.shadowRoot) return element.shadowRoot;
    try { return globalThis.chrome?.dom?.openOrClosedShadowRoot?.(element) || null; }
    catch { return null; }
  }

  function parent(element) {
    return element.parentElement || element.getRootNode()?.host || null;
  }

  function closest(element, selector) {
    for (let node = element; node instanceof Element; node = node.getRootNode()?.host) {
      const match = node.closest(selector);
      if (match) return match;
    }
    return null;
  }

  function contains(scope, element) {
    for (let node = element; node; node = node.getRootNode()?.host) {
      if (scope === node || scope.contains(node)) return true;
    }
    return false;
  }

  function activeElement() {
    let active = document.activeElement;
    let inner;
    while (active && (inner = shadowRoot(active)?.activeElement)) active = inner;
    return active;
  }

  function createScope({ shadow = false } = {}) {
    let roots = [document];
    let lastDiscovery = 0;
    function refresh(force = false) {
      if (!shadow) return false;
      // Scans caused by typing can run often. Avoid walking the entire feed and
      // querying Chrome's closed-root API on every keystroke; focus/inspection
      // can explicitly refresh immediately when a new chat has just opened.
      const now = Date.now();
      if (!force && now - lastDiscovery < 750) return false;
      lastDiscovery = now;
      const next = [document];
      for (let index = 0; index < next.length; index++) {
        for (const element of next[index].querySelectorAll('*')) {
          const root = shadowRoot(element);
          if (root) next.push(root);
        }
      }
      const changed = next.length !== roots.length || next.some((root, index) => root !== roots[index]);
      roots = next;
      return changed;
    }

    function queryAll(selector, scope = document) {
      const contexts = shadow ? [scope, ...roots.filter((root) => root !== document && root !== scope && contains(scope, root.host))] : [scope];
      return [...new Set(contexts.flatMap((root) => [...root.querySelectorAll(selector)]))];
    }

    function queryFirst(selector, scope = document) {
      return queryAll(selector, scope)[0] || null;
    }

    return Object.freeze({ refresh, queryAll, queryFirst, roots: () => [...roots], closest, contains, parent, activeElement });
  }

  globalThis.ChatTranslatorDOM = Object.freeze({ createScope });
})();
