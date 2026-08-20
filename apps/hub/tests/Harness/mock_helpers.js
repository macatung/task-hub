/**
 * Comprehensive Mock Test Doubles for macatung.dev Test Infrastructure
 * Covers: DOM, Web Audio API, HTML5 Canvas 2D, localStorage, Window/Viewport/Touches, and Inertia router/forms.
 */

// ============================================================================
// 1. DOM & Event Test Doubles
// ============================================================================

export class MockEvent {
  constructor(type, eventInitDict = {}) {
    this.type = String(type);
    this.bubbles = Boolean(eventInitDict.bubbles ?? true);
    this.cancelable = Boolean(eventInitDict.cancelable ?? true);
    this.defaultPrevented = false;
    this.propagationStopped = false;
    this.immediatePropagationStopped = false;
    this.target = null;
    this.currentTarget = null;
    this.timeStamp = Date.now();
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  stopPropagation() {
    this.propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.immediatePropagationStopped = true;
    this.propagationStopped = true;
  }
}

export class MockCustomEvent extends MockEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);
    this.detail = eventInitDict.detail ?? null;
  }
}

export class MockMouseEvent extends MockEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);
    this.clientX = eventInitDict.clientX ?? 0;
    this.clientY = eventInitDict.clientY ?? 0;
    this.pageX = eventInitDict.pageX ?? this.clientX;
    this.pageY = eventInitDict.pageY ?? this.clientY;
    this.screenX = eventInitDict.screenX ?? this.clientX;
    this.screenY = eventInitDict.screenY ?? this.clientY;
    this.button = eventInitDict.button ?? 0;
    this.buttons = eventInitDict.buttons ?? 1;
    this.altKey = Boolean(eventInitDict.altKey);
    this.ctrlKey = Boolean(eventInitDict.ctrlKey);
    this.shiftKey = Boolean(eventInitDict.shiftKey);
    this.metaKey = Boolean(eventInitDict.metaKey);
  }
}

export class MockKeyboardEvent extends MockEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);
    this.key = eventInitDict.key ?? '';
    this.code = eventInitDict.code ?? '';
    this.keyCode = eventInitDict.keyCode ?? (this.key.charCodeAt(0) || 0);
    this.altKey = Boolean(eventInitDict.altKey);
    this.ctrlKey = Boolean(eventInitDict.ctrlKey);
    this.shiftKey = Boolean(eventInitDict.shiftKey);
    this.metaKey = Boolean(eventInitDict.metaKey);
    this.repeat = Boolean(eventInitDict.repeat);
  }
}

export class MockTouch {
  constructor(touchInitDict = {}) {
    this.identifier = touchInitDict.identifier ?? 1;
    this.target = touchInitDict.target ?? null;
    this.clientX = touchInitDict.clientX ?? 0;
    this.clientY = touchInitDict.clientY ?? 0;
    this.pageX = touchInitDict.pageX ?? this.clientX;
    this.pageY = touchInitDict.pageY ?? this.clientY;
    this.screenX = touchInitDict.screenX ?? this.clientX;
    this.screenY = touchInitDict.screenY ?? this.clientY;
    this.radiusX = touchInitDict.radiusX ?? 10;
    this.radiusY = touchInitDict.radiusY ?? 10;
    this.rotationAngle = touchInitDict.rotationAngle ?? 0;
    this.force = touchInitDict.force ?? 1.0;
  }
}

export class MockTouchEvent extends MockEvent {
  constructor(type, eventInitDict = {}) {
    super(type, eventInitDict);
    this.touches = Array.isArray(eventInitDict.touches)
      ? eventInitDict.touches.map((t) => (t instanceof MockTouch ? t : new MockTouch(t)))
      : [];
    this.targetTouches = Array.isArray(eventInitDict.targetTouches)
      ? eventInitDict.targetTouches.map((t) => (t instanceof MockTouch ? t : new MockTouch(t)))
      : [...this.touches];
    this.changedTouches = Array.isArray(eventInitDict.changedTouches)
      ? eventInitDict.changedTouches.map((t) => (t instanceof MockTouch ? t : new MockTouch(t)))
      : [...this.touches];
    this.altKey = Boolean(eventInitDict.altKey);
    this.ctrlKey = Boolean(eventInitDict.ctrlKey);
    this.shiftKey = Boolean(eventInitDict.shiftKey);
    this.metaKey = Boolean(eventInitDict.metaKey);
  }
}

export class MockClassList {
  constructor(element) {
    this._element = element;
    this._classes = new Set();
  }

  _syncFromClassName(className) {
    this._classes.clear();
    if (className) {
      className
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => this._classes.add(c));
    }
  }

  _syncToClassName() {
    this._element._className = Array.from(this._classes).join(' ');
  }

  add(...tokens) {
    for (const token of tokens) {
      if (token) this._classes.add(String(token));
    }
    this._syncToClassName();
  }

  remove(...tokens) {
    for (const token of tokens) {
      this._classes.delete(String(token));
    }
    this._syncToClassName();
  }

  toggle(token, force) {
    const sToken = String(token);
    if (typeof force === 'boolean') {
      if (force) {
        this.add(sToken);
      } else {
        this.remove(sToken);
      }
      return force;
    }
    if (this._classes.has(sToken)) {
      this.remove(sToken);
      return false;
    }
    this.add(sToken);
    return true;
  }

  contains(token) {
    return this._classes.has(String(token));
  }

  replace(oldToken, newToken) {
    if (this._classes.has(String(oldToken))) {
      this.remove(oldToken);
      this.add(newToken);
      return true;
    }
    return false;
  }

  toString() {
    return Array.from(this._classes).join(' ');
  }

  get length() {
    return this._classes.size;
  }

  forEach(callback, thisArg) {
    this._classes.forEach(callback, thisArg);
  }

  [Symbol.iterator]() {
    return this._classes.values();
  }
}

export class MockStyle {
  constructor() {
    this._properties = new Map();
    return new Proxy(this, {
      get(target, prop) {
        if (typeof prop === 'string' && !(prop in target)) {
          return target.getPropertyValue(prop);
        }
        return target[prop];
      },
      set(target, prop, value) {
        if (typeof prop === 'string' && !(prop in target)) {
          target.setProperty(prop, String(value));
          return true;
        }
        target[prop] = value;
        return true;
      }
    });
  }

  _normalize(name) {
    return String(name).replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  setProperty(name, value) {
    this._properties.set(this._normalize(name), String(value));
  }

  getPropertyValue(name) {
    return this._properties.get(this._normalize(name)) || '';
  }

  removeProperty(name) {
    const key = this._normalize(name);
    const val = this._properties.get(key) || '';
    this._properties.delete(key);
    return val;
  }

  get cssText() {
    return Array.from(this._properties.entries())
      .map(([k, v]) => `${k}: ${v};`)
      .join(' ');
  }

  set cssText(val) {
    this._properties.clear();
    if (!val) return;
    val.split(';').forEach((chunk) => {
      const parts = chunk.split(':');
      if (parts.length >= 2) {
        const k = parts[0].trim();
        const v = parts.slice(1).join(':').trim();
        if (k && v) this.setProperty(k, v);
      }
    });
  }
}

export class MockNode {
  constructor(nodeType = 1, nodeName = 'DIV') {
    this.nodeType = nodeType;
    this.nodeName = String(nodeName).toUpperCase();
    this.parentNode = null;
    this.parentElement = null;
    this.childNodes = [];
    this.ownerDocument = null;
    this._listeners = new Map();
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] || null;
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    return idx >= 0 && idx < this.parentNode.childNodes.length - 1
      ? this.parentNode.childNodes[idx + 1]
      : null;
  }

  get previousSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    return idx > 0 ? this.parentNode.childNodes[idx - 1] : null;
  }

  appendChild(child) {
    if (child.parentNode) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    if (this.nodeType === 1) {
      child.parentElement = this;
    }
    this.childNodes.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx === -1) {
      throw new Error('NotFoundError: child node not found in parent');
    }
    this.childNodes.splice(idx, 1);
    child.parentNode = null;
    child.parentElement = null;
    return child;
  }

  insertBefore(newChild, refChild) {
    if (!refChild) {
      return this.appendChild(newChild);
    }
    const idx = this.childNodes.indexOf(refChild);
    if (idx === -1) {
      throw new Error('NotFoundError: reference child node not found');
    }
    if (newChild.parentNode) {
      newChild.parentNode.removeChild(newChild);
    }
    newChild.parentNode = this;
    if (this.nodeType === 1) {
      newChild.parentElement = this;
    }
    this.childNodes.splice(idx, 0, newChild);
    return newChild;
  }

  replaceChild(newChild, oldChild) {
    this.insertBefore(newChild, oldChild);
    return this.removeChild(oldChild);
  }

  contains(otherNode) {
    if (!otherNode) return false;
    if (otherNode === this) return true;
    let curr = otherNode.parentNode;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode;
    }
    return false;
  }

  addEventListener(type, listener, options = {}) {
    const sType = String(type).toLowerCase();
    if (!this._listeners.has(sType)) {
      this._listeners.set(sType, []);
    }
    const once = typeof options === 'object' ? Boolean(options?.once) : false;
    const capture = typeof options === 'object' ? Boolean(options?.capture) : Boolean(options);
    this._listeners.get(sType).push({ listener, once, capture });
  }

  removeEventListener(type, listener) {
    const sType = String(type).toLowerCase();
    const list = this._listeners.get(sType);
    if (list) {
      this._listeners.set(
        sType,
        list.filter((entry) => entry.listener !== listener)
      );
    }
  }

  dispatchEvent(event) {
    if (!event) return true;
    if (!event.target) event.target = this;
    event.currentTarget = this;

    const sType = String(event.type).toLowerCase();
    const list = this._listeners.get(sType) || [];
    const toRemove = [];

    for (const entry of [...list]) {
      if (event.immediatePropagationStopped) break;
      try {
        if (typeof entry.listener === 'function') {
          entry.listener.call(this, event);
        } else if (entry.listener && typeof entry.listener.handleEvent === 'function') {
          entry.listener.handleEvent(event);
        }
      } catch (err) {
        console.error(`Error in event listener for ${sType}:`, err);
      }
      if (entry.once) {
        toRemove.push(entry);
      }
    }

    if (toRemove.length > 0) {
      this._listeners.set(
        sType,
        (this._listeners.get(sType) || []).filter((e) => !toRemove.includes(e))
      );
    }

    // Bubble up if requested
    if (event.bubbles && !event.propagationStopped && this.parentNode) {
      this.parentNode.dispatchEvent(event);
    }

    return !event.defaultPrevented;
  }
}

export class MockElement extends MockNode {
  constructor(tagName = 'DIV', ownerDocument = null) {
    super(1, tagName);
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this._attributes = new Map();
    this._className = '';
    this.classList = new MockClassList(this);
    this.style = new MockStyle();
    this.dataset = new Proxy(
      {},
      {
        get: (t, prop) => this.getAttribute(`data-${String(prop)}`),
        set: (t, prop, val) => {
          this.setAttribute(`data-${String(prop)}`, String(val));
          return true;
        },
        has: (t, prop) => this.hasAttribute(`data-${String(prop)}`),
        deleteProperty: (t, prop) => {
          this.removeAttribute(`data-${String(prop)}`);
          return true;
        }
      }
    );

    // Common HTML element properties
    this._value = '';
    this._checked = false;
    this._disabled = false;
    this.clientWidth = 1024;
    this.clientHeight = 768;
    this.offsetWidth = 1024;
    this.offsetHeight = 768;
    this.scrollWidth = 1024;
    this.scrollHeight = 768;
    this.scrollTop = 0;
    this.scrollLeft = 0;
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(val) {
    if (val) {
      this.setAttribute('id', val);
    } else {
      this.removeAttribute('id');
    }
  }

  get className() {
    return this._className;
  }

  set className(val) {
    this._className = String(val || '');
    this.classList._syncFromClassName(this._className);
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._value = String(val ?? '');
  }

  get checked() {
    return Boolean(this._checked);
  }

  set checked(val) {
    this._checked = Boolean(val);
  }

  get disabled() {
    return Boolean(this._disabled) || this.hasAttribute('disabled');
  }

  set disabled(val) {
    this._disabled = Boolean(val);
    if (val) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  get href() {
    return this.getAttribute('href') || '';
  }

  set href(val) {
    this.setAttribute('href', String(val ?? ''));
  }

  get target() {
    return this.getAttribute('target') || '';
  }

  set target(val) {
    this.setAttribute('target', String(val ?? ''));
  }

  get rel() {
    return this.getAttribute('rel') || '';
  }

  set rel(val) {
    this.setAttribute('rel', String(val ?? ''));
  }

  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }

  setAttribute(name, value) {
    const k = String(name).toLowerCase();
    const v = String(value);
    this._attributes.set(k, v);
    if (k === 'class') {
      this.className = v;
    }
  }

  getAttribute(name) {
    const k = String(name).toLowerCase();
    return this._attributes.has(k) ? this._attributes.get(k) : null;
  }

  hasAttribute(name) {
    return this._attributes.has(String(name).toLowerCase());
  }

  removeAttribute(name) {
    const k = String(name).toLowerCase();
    this._attributes.delete(k);
    if (k === 'class') {
      this.className = '';
    }
  }

  getAttributeNames() {
    return Array.from(this._attributes.keys());
  }

  get textContent() {
    let text = '';
    for (const child of this.childNodes) {
      if (child.nodeType === 3) {
        text += child.nodeValue;
      } else if (child.textContent) {
        text += child.textContent;
      }
    }
    return text;
  }

  set textContent(val) {
    this.childNodes = [];
    if (val !== undefined && val !== null && val !== '') {
      const textNode = new MockNode(3, '#text');
      textNode.nodeValue = String(val);
      textNode.parentNode = this;
      textNode.parentElement = this;
      this.childNodes.push(textNode);
    }
  }

  get innerHTML() {
    // Basic representation for opaque-box inspection
    return this.textContent;
  }

  set innerHTML(val) {
    this.textContent = String(val ?? '');
  }

  getBoundingClientRect() {
    const width = this.offsetWidth || this.clientWidth || 100;
    const height = this.offsetHeight || this.clientHeight || 50;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: height,
      right: width,
      width,
      height,
      toJSON() {
        return this;
      }
    };
  }

  scrollIntoView() {}
  focus() {
    this.dispatchEvent(new MockEvent('focus', { bubbles: false }));
  }
  blur() {
    this.dispatchEvent(new MockEvent('blur', { bubbles: false }));
  }
  click() {
    this.dispatchEvent(new MockMouseEvent('click', { bubbles: true, cancelable: true }));
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  // Selector engine
  _matchesSelector(selector) {
    const sel = selector.trim();
    if (sel === '*') return true;
    if (sel.startsWith('#')) {
      return this.id === sel.slice(1);
    }
    if (sel.startsWith('.')) {
      return this.classList.contains(sel.slice(1));
    }
    if (sel.startsWith('[') && sel.endsWith(']')) {
      const inner = sel.slice(1, -1);
      if (inner.includes('=')) {
        const [attr, rawVal] = inner.split('=');
        const val = rawVal.replace(/^["']|["']$/g, '');
        return this.getAttribute(attr.trim()) === val;
      }
      return this.hasAttribute(inner.trim());
    }
    if (/^[a-zA-Z0-9_-]+$/.test(sel)) {
      return this.tagName.toLowerCase() === sel.toLowerCase();
    }
    return false;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector) {
    const results = [];
    const traverse = (node) => {
      for (const child of node.children) {
        if (child._matchesSelector(selector)) {
          results.push(child);
        }
        traverse(child);
      }
    };
    traverse(this);
    return results;
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  getElementsByClassName(className) {
    return this.querySelectorAll(`.${className}`);
  }

  getElementsByTagName(tagName) {
    return this.querySelectorAll(tagName);
  }

  closest(selector) {
    let curr = this;
    while (curr && curr.nodeType === 1) {
      if (curr._matchesSelector(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }
}

export class MockHTMLCanvasElement extends MockElement {
  constructor(ownerDocument = null) {
    super('CANVAS', ownerDocument);
    this.width = 800;
    this.height = 600;
    this._ctx2d = null;
  }

  getContext(contextType, _contextAttributes) {
    if (contextType === '2d') {
      if (!this._ctx2d) {
        this._ctx2d = new MockCanvasRenderingContext2D(this);
      }
      return this._ctx2d;
    }
    return null;
  }

  toDataURL(type = 'image/png', _quality = 0.92) {
    return `data:${type};base64,mockCanvasDataURL_${this.width}x${this.height}`;
  }

  toBlob(callback, type = 'image/png', _quality = 0.92) {
    if (typeof callback === 'function') {
      callback({ size: this.width * this.height * 4, type });
    }
  }
}

export class MockDocument extends MockNode {
  constructor() {
    super(9, '#document');
    this.documentElement = new MockElement('HTML', this);
    this.head = new MockElement('HEAD', this);
    this.body = new MockElement('BODY', this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.title = 'macatung.dev Portfolio';
    this.body.ownerDocument = this;
    this.head.ownerDocument = this;
    this.documentElement.ownerDocument = this;
  }

  createElement(tagName) {
    const sTag = String(tagName).toUpperCase();
    if (sTag === 'CANVAS') {
      return new MockHTMLCanvasElement(this);
    }
    return new MockElement(sTag, this);
  }

  createElementNS(namespaceURI, qualifiedName) {
    const el = this.createElement(qualifiedName);
    el.namespaceURI = namespaceURI;
    return el;
  }

  createTextNode(text) {
    const textNode = new MockNode(3, '#text');
    textNode.nodeValue = String(text ?? '');
    textNode.ownerDocument = this;
    return textNode;
  }

  createDocumentFragment() {
    const frag = new MockNode(11, '#document-fragment');
    frag.ownerDocument = this;
    return frag;
  }

  createEvent(type) {
    return new MockEvent(type);
  }

  getElementById(id) {
    return this.documentElement.getElementById(id);
  }

  getElementsByClassName(className) {
    return this.documentElement.getElementsByClassName(className);
  }

  getElementsByTagName(tagName) {
    return this.documentElement.getElementsByTagName(tagName);
  }

  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }
}

export class MockWindow extends MockNode {
  constructor() {
    super(0, '#window');
    this.window = this;
    this.self = this;
    this.document = new MockDocument();
    this.innerWidth = 1440;
    this.innerHeight = 900;
    this.outerWidth = 1440;
    this.outerHeight = 900;
    this.scrollX = 0;
    this.scrollY = 0;
    this.pageXOffset = 0;
    this.pageYOffset = 0;

    this.location = {
      href: 'http://localhost:8000/',
      origin: 'http://localhost:8000',
      protocol: 'http:',
      host: 'localhost:8000',
      hostname: 'localhost',
      port: '8000',
      pathname: '/',
      search: '',
      hash: '',
      assign(url) {
        this.href = String(url);
      },
      reload() {},
      replace(url) {
        this.href = String(url);
      }
    };

    this.history = {
      length: 1,
      state: null,
      pushState(state, _title, _url) {
        this.state = state;
      },
      replaceState(state, _title, _url) {
        this.state = state;
      },
      back() {},
      forward() {},
      go(_delta) {}
    };

    this._clipboardText = '';
    this.navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MockBrowser/1.0',
      clipboard: {
        writeText: async (text) => {
          this._clipboardText = String(text);
          return Promise.resolve();
        },
        readText: async () => {
          return Promise.resolve(this._clipboardText);
        }
      }
    };

    this.localStorage = new MockStorage();
    this.sessionStorage = new MockStorage();
  }

  scrollTo(x, y) {
    if (typeof x === 'object' && x !== null) {
      this.scrollX = x.left ?? this.scrollX;
      this.scrollY = x.top ?? this.scrollY;
    } else {
      this.scrollX = Number(x) || 0;
      this.scrollY = Number(y) || 0;
    }
    this.pageXOffset = this.scrollX;
    this.pageYOffset = this.scrollY;
    this.dispatchEvent(new MockEvent('scroll', { bubbles: false }));
  }

  scrollBy(x, y) {
    this.scrollTo(this.scrollX + (Number(x) || 0), this.scrollY + (Number(y) || 0));
  }

  resizeTo(width, height) {
    this.innerWidth = Number(width) || 1440;
    this.innerHeight = Number(height) || 900;
    this.outerWidth = this.innerWidth;
    this.outerHeight = this.innerHeight;
    this.dispatchEvent(new MockEvent('resize', { bubbles: false }));
  }

  getComputedStyle(element) {
    return element && element.style ? element.style : new MockStyle();
  }

  matchMedia(query) {
    const sQuery = String(query);
    let matches = false;
    const maxWidthMatch = sQuery.match(/max-width:\s*(\d+)px/);
    if (maxWidthMatch) {
      const maxW = parseInt(maxWidthMatch[1], 10);
      matches = this.innerWidth <= maxW;
    }
    const minWidthMatch = sQuery.match(/min-width:\s*(\d+)px/);
    if (minWidthMatch) {
      const minW = parseInt(minWidthMatch[1], 10);
      matches = this.innerWidth >= minW;
    }
    return {
      matches,
      media: sQuery,
      onchange: null,
      addListener(_listener) {},
      removeListener(_listener) {},
      addEventListener(_type, _listener) {},
      removeEventListener(_type, _listener) {},
      dispatchEvent(_event) {
        return true;
      }
    };
  }

  requestAnimationFrame(cb) {
    return setTimeout(() => cb(Date.now()), 16);
  }

  cancelAnimationFrame(id) {
    clearTimeout(id);
  }
}

// ============================================================================
// 2. Storage Test Double (localStorage / sessionStorage)
// ============================================================================

export class MockStorage {
  constructor() {
    this._store = new Map();
    return new Proxy(this, {
      get(target, prop) {
        if (typeof prop === 'string' && !(prop in target)) {
          return target.getItem(prop);
        }
        return target[prop];
      },
      set(target, prop, value) {
        if (typeof prop === 'string' && !(prop in target)) {
          target.setItem(prop, String(value));
          return true;
        }
        target[prop] = value;
        return true;
      },
      deleteProperty(target, prop) {
        if (typeof prop === 'string' && !(prop in target)) {
          target.removeItem(prop);
          return true;
        }
        delete target[prop];
        return true;
      }
    });
  }

  getItem(key) {
    const sKey = String(key);
    return this._store.has(sKey) ? this._store.get(sKey) : null;
  }

  setItem(key, value) {
    this._store.set(String(key), String(value));
  }

  removeItem(key) {
    this._store.delete(String(key));
  }

  clear() {
    this._store.clear();
  }

  key(index) {
    const keys = Array.from(this._store.keys());
    return index >= 0 && index < keys.length ? keys[index] : null;
  }

  get length() {
    return this._store.size;
  }

  dump() {
    const out = {};
    for (const [k, v] of this._store.entries()) {
      out[k] = v;
    }
    return out;
  }

  load(obj) {
    this.clear();
    if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        this.setItem(k, v);
      }
    }
  }
}

// ============================================================================
// 3. Web Audio API Test Doubles
// ============================================================================

export class MockAudioParam {
  constructor(defaultValue = 1.0, minValue = -3.4e38, maxValue = 3.4e38) {
    this.value = defaultValue;
    this.defaultValue = defaultValue;
    this.minValue = minValue;
    this.maxValue = maxValue;
    this.events = [];
  }

  setValueAtTime(value, startTime) {
    this.value = Number(value);
    this.events.push({ type: 'setValueAtTime', value: Number(value), time: Number(startTime) });
    return this;
  }

  linearRampToValueAtTime(value, endTime) {
    this.value = Number(value);
    this.events.push({
      type: 'linearRampToValueAtTime',
      value: Number(value),
      time: Number(endTime)
    });
    return this;
  }

  exponentialRampToValueAtTime(value, endTime) {
    this.value = Number(value);
    this.events.push({
      type: 'exponentialRampToValueAtTime',
      value: Number(value),
      time: Number(endTime)
    });
    return this;
  }

  setTargetAtTime(target, startTime, timeConstant) {
    this.value = Number(target);
    this.events.push({
      type: 'setTargetAtTime',
      target: Number(target),
      time: Number(startTime),
      timeConstant: Number(timeConstant)
    });
    return this;
  }

  setValueCurveAtTime(values, startTime, duration) {
    this.events.push({
      type: 'setValueCurveAtTime',
      values: Array.from(values),
      time: Number(startTime),
      duration: Number(duration)
    });
    return this;
  }

  cancelScheduledValues(startTime) {
    this.events = this.events.filter((e) => e.time < startTime);
    return this;
  }

  cancelAndHoldAtTime(cancelTime) {
    this.events = this.events.filter((e) => e.time <= cancelTime);
    return this;
  }

  getScheduledEvents() {
    return [...this.events];
  }
}

export class MockAudioNode {
  constructor(context) {
    this.context = context;
    this.numberOfInputs = 1;
    this.numberOfOutputs = 1;
    this.connectedTo = [];
  }

  connect(destinationNode, outputIndex = 0, inputIndex = 0) {
    this.connectedTo.push({ destination: destinationNode, outputIndex, inputIndex });
    return destinationNode;
  }

  disconnect(destinationNode) {
    if (destinationNode) {
      this.connectedTo = this.connectedTo.filter((c) => c.destination !== destinationNode);
    } else {
      this.connectedTo = [];
    }
  }

  getConnections() {
    return [...this.connectedTo];
  }
}

export class MockGainNode extends MockAudioNode {
  constructor(context, defaultGain = 1.0) {
    super(context);
    this.gain = new MockAudioParam(defaultGain, 0, 100);
  }
}

export class MockOscillatorNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = 'sine';
    this.frequency = new MockAudioParam(440, 0, 24000);
    this.detune = new MockAudioParam(0, -153600, 153600);
    this.started = false;
    this.stopped = false;
    this.startTime = null;
    this.stopTime = null;
    this.onended = null;
  }

  start(when = 0) {
    this.started = true;
    this.startTime = Number(when);
  }

  stop(when = 0) {
    this.stopped = true;
    this.stopTime = Number(when);
    if (typeof this.onended === 'function') {
      setTimeout(() => this.onended?.(), 0);
    }
  }

  setPeriodicWave(_wave) {
    this.type = 'custom';
  }
}

export class MockAudioBuffer {
  constructor({ numberOfChannels = 1, length = 44100, sampleRate = 44100 } = {}) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._channels = [];
    for (let i = 0; i < numberOfChannels; i++) {
      this._channels.push(new Float32Array(length));
    }
  }

  getChannelData(channelIndex) {
    if (channelIndex < 0 || channelIndex >= this.numberOfChannels) {
      throw new Error('IndexSizeError');
    }
    return this._channels[channelIndex];
  }

  copyFromChannel(destination, channelNumber, bufferOffset = 0) {
    const src = this.getChannelData(channelNumber);
    for (let i = 0; i < destination.length && i + bufferOffset < src.length; i++) {
      destination[i] = src[i + bufferOffset];
    }
  }

  copyToChannel(source, channelNumber, bufferOffset = 0) {
    const dest = this.getChannelData(channelNumber);
    for (let i = 0; i < source.length && i + bufferOffset < dest.length; i++) {
      dest[i + bufferOffset] = source[i];
    }
  }
}

export class MockAudioBufferSourceNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.buffer = null;
    this.playbackRate = new MockAudioParam(1.0, 0, 1024);
    this.detune = new MockAudioParam(0, -153600, 153600);
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.started = false;
    this.stopped = false;
    this.onended = null;
  }

  start(when = 0, _offset = 0, _duration) {
    this.started = true;
    this.startTime = when;
  }

  stop(when = 0) {
    this.stopped = true;
    this.stopTime = when;
    if (typeof this.onended === 'function') {
      setTimeout(() => this.onended?.(), 0);
    }
  }
}

export class MockBiquadFilterNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350, 10, 24000);
    this.detune = new MockAudioParam(0, -153600, 153600);
    this.Q = new MockAudioParam(1, 0.0001, 1000);
    this.gain = new MockAudioParam(0, -40, 40);
  }
}

export class MockAudioDestinationNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.maxChannelCount = 2;
  }
}

export class MockAudioContext {
  static instances = [];
  static lastInstance = null;

  constructor(options = {}) {
    this._ownerWindow = typeof window !== 'undefined' ? window : null;
    this.state = options.state || 'running';
    this.currentTime = 0.0;
    this.sampleRate = options.sampleRate || 44100;
    this.destination = new MockAudioDestinationNode(this);
    this.activeNodes = [];
    MockAudioContext.instances.push(this);
    MockAudioContext.lastInstance = this;
    try {
      globalThis._lastAudioContext = this;
    } catch {}
  }

  advanceTime(seconds) {
    this.currentTime += Number(seconds) || 0;
  }

  createGain() {
    const gain = new MockGainNode(this);
    this.activeNodes.push(gain);
    return gain;
  }

  createOscillator() {
    const osc = new MockOscillatorNode(this);
    this.activeNodes.push(osc);
    return osc;
  }

  createBuffer(channels, length, sampleRate) {
    return new MockAudioBuffer({
      numberOfChannels: channels,
      length,
      sampleRate: sampleRate || this.sampleRate
    });
  }

  createBufferSource() {
    const src = new MockAudioBufferSourceNode(this);
    this.activeNodes.push(src);
    return src;
  }

  createBiquadFilter() {
    const filter = new MockBiquadFilterNode(this);
    this.activeNodes.push(filter);
    return filter;
  }

  async resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  async suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }

  async close() {
    this.state = 'closed';
    return Promise.resolve();
  }

  async decodeAudioData(_audioData) {
    return Promise.resolve(new MockAudioBuffer({ numberOfChannels: 2, length: 44100 }));
  }

  getAllOscillators() {
    const all = [];
    for (const inst of MockAudioContext.instances) {
      all.push(...inst.activeNodes.filter((n) => n instanceof MockOscillatorNode));
    }
    if (all.length === 0) {
      return this.activeNodes.filter((n) => n instanceof MockOscillatorNode);
    }
    return all;
  }

  getAllGains() {
    const all = [];
    for (const inst of MockAudioContext.instances) {
      all.push(...inst.activeNodes.filter((n) => n instanceof MockGainNode));
    }
    if (all.length === 0) {
      return this.activeNodes.filter((n) => n instanceof MockGainNode);
    }
    return all;
  }

  reset() {
    this.state = 'running';
    this.currentTime = 0.0;
    this.activeNodes = [];
    for (const inst of MockAudioContext.instances) {
      inst.activeNodes = [];
    }
  }
}

// ============================================================================
// 4. HTML5 Canvas 2D Test Doubles
// ============================================================================

export class MockCanvasGradient {
  constructor(type, coords) {
    this.type = type;
    this.coords = coords;
    this.colorStops = [];
  }

  addColorStop(offset, color) {
    this.colorStops.push({ offset: Number(offset), color: String(color) });
  }
}

export class MockCanvasRenderingContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.miterLimit = 10;
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = 'source-over';
    this.shadowBlur = 0;
    this.shadowColor = 'rgba(0, 0, 0, 0)';
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this.imageSmoothingEnabled = true;

    this.currentPath = [];
    this.stateStack = [];
    this.calls = [];
  }

  _record(method, args) {
    this.calls.push({
      method,
      args: Array.from(args),
      state: {
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        globalAlpha: this.globalAlpha,
        lineWidth: this.lineWidth,
        font: this.font
      }
    });
  }

  save() {
    this._record('save', arguments);
    this.stateStack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
      shadowBlur: this.shadowBlur,
      shadowColor: this.shadowColor,
      font: this.font,
      textAlign: this.textAlign,
      textBaseline: this.textBaseline
    });
  }

  restore() {
    this._record('restore', arguments);
    if (this.stateStack.length > 0) {
      const state = this.stateStack.pop();
      Object.assign(this, state);
    }
  }

  scale(_x, _y) {
    this._record('scale', arguments);
  }
  rotate(_angle) {
    this._record('rotate', arguments);
  }
  translate(_x, _y) {
    this._record('translate', arguments);
  }
  transform(_a, _b, _c, _d, _e, _f) {
    this._record('transform', arguments);
  }
  setTransform(_a, _b, _c, _d, _e, _f) {
    this._record('setTransform', arguments);
  }
  resetTransform() {
    this._record('resetTransform', arguments);
  }

  beginPath() {
    this._record('beginPath', arguments);
    this.currentPath = [];
  }

  closePath() {
    this._record('closePath', arguments);
    this.currentPath.push({ type: 'closePath' });
  }

  moveTo(x, y) {
    this._record('moveTo', arguments);
    this.currentPath.push({ type: 'moveTo', x: Number(x), y: Number(y) });
  }

  lineTo(x, y) {
    this._record('lineTo', arguments);
    this.currentPath.push({ type: 'lineTo', x: Number(x), y: Number(y) });
  }

  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    this._record('bezierCurveTo', arguments);
    this.currentPath.push({ type: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y });
  }

  quadraticCurveTo(cpx, cpy, x, y) {
    this._record('quadraticCurveTo', arguments);
    this.currentPath.push({ type: 'quadraticCurveTo', cpx, cpy, x, y });
  }

  arc(x, y, radius, startAngle, endAngle, counterclockwise = false) {
    this._record('arc', arguments);
    this.currentPath.push({
      type: 'arc',
      x: Number(x),
      y: Number(y),
      radius: Number(radius),
      startAngle: Number(startAngle),
      endAngle: Number(endAngle),
      counterclockwise: Boolean(counterclockwise)
    });
  }

  rect(x, y, w, h) {
    this._record('rect', arguments);
    this.currentPath.push({
      type: 'rect',
      x: Number(x),
      y: Number(y),
      w: Number(w),
      h: Number(h)
    });
  }

  fill(_fillRule) {
    this._record('fill', arguments);
  }

  stroke() {
    this._record('stroke', arguments);
  }

  fillRect(_x, _y, _w, _h) {
    this._record('fillRect', arguments);
  }

  strokeRect(_x, _y, _w, _h) {
    this._record('strokeRect', arguments);
  }

  clearRect(_x, _y, _w, _h) {
    this._record('clearRect', arguments);
  }

  fillText(_text, _x, _y, _maxWidth) {
    this._record('fillText', arguments);
  }

  strokeText(_text, _x, _y, _maxWidth) {
    this._record('strokeText', arguments);
  }

  measureText(text) {
    const s = String(text ?? '');
    return {
      width: s.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 4
    };
  }

  createLinearGradient(_x0, _y0, _x1, _y1) {
    this._record('createLinearGradient', arguments);
    return new MockCanvasGradient('linear', { x0: _x0, y0: _y0, x1: _x1, y1: _y1 });
  }

  createRadialGradient(_x0, _y0, _r0, _x1, _y1, _r1) {
    this._record('createRadialGradient', arguments);
    return new MockCanvasGradient('radial', { x0: _x0, y0: _y0, r0: _r0, x1: _x1, y1: _y1, r1: _r1 });
  }

  createPattern(image, repetition) {
    this._record('createPattern', arguments);
    return { image, repetition };
  }

  createImageData(width, height) {
    return {
      width: Number(width),
      height: Number(height),
      data: new Uint8ClampedArray(Number(width) * Number(height) * 4)
    };
  }

  getImageData(sx, sy, sw, sh) {
    return this.createImageData(sw, sh);
  }

  putImageData(_imageData, _dx, _dy) {
    this._record('putImageData', arguments);
  }

  drawImage(image, ...args) {
    this._record('drawImage', [image, ...args]);
  }

  // Inspection helpers
  getCalls(methodName) {
    return this.calls.filter((c) => c.method === methodName);
  }

  getDrawnRects() {
    return this.calls
      .filter((c) => ['fillRect', 'strokeRect', 'clearRect'].includes(c.method))
      .map((c) => ({
        type: c.method,
        x: c.args[0],
        y: c.args[1],
        w: c.args[2],
        h: c.args[3],
        style: c.state.fillStyle,
        alpha: c.state.globalAlpha
      }));
  }

  getDrawnTexts() {
    return this.calls
      .filter((c) => ['fillText', 'strokeText'].includes(c.method))
      .map((c) => ({
        type: c.method,
        text: c.args[0],
        x: c.args[1],
        y: c.args[2],
        font: c.state.font,
        style: c.state.fillStyle,
        alpha: c.state.globalAlpha
      }));
  }

  getDrawnArcs() {
    return this.calls
      .filter((c) => c.method === 'arc')
      .map((c) => ({
        x: c.args[0],
        y: c.args[1],
        radius: c.args[2],
        startAngle: c.args[3],
        endAngle: c.args[4],
        counterclockwise: c.args[5]
      }));
  }

  clearHistory() {
    this.calls = [];
    this.currentPath = [];
    this.stateStack = [];
  }
}

// ============================================================================
// 5. Inertia Router & useForm Test Doubles
// ============================================================================

export class MockInertiaRouter {
  constructor() {
    this.requests = [];
    this.handlers = new Map();
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event, ...args) {
    for (const cb of this.listeners.get(event) || []) {
      try {
        cb(...args);
      } catch (e) {
        console.error('Inertia event error:', e);
      }
    }
  }

  setMockResponse(method, url, response) {
    this.handlers.set(`${method.toUpperCase()} ${url}`, response);
  }

  async visit(url, options = {}) {
    const method = (options.method || 'get').toUpperCase();
    const data = options.data || {};
    const req = { method, url, data, options, timestamp: Date.now() };
    this.requests.push(req);

    this.emit('start', { detail: { visit: req } });
    if (typeof options.onStart === 'function') options.onStart(req);

    const handler = this.handlers.get(`${method} ${url}`) || { status: 200, props: {} };
    const response = typeof handler === 'function' ? await handler(data, options) : handler;

    if (response.status >= 400) {
      if (typeof options.onError === 'function') options.onError(response.errors || {});
      this.emit('error', { detail: { errors: response.errors } });
    } else {
      if (typeof options.onSuccess === 'function') options.onSuccess({ props: response.props });
      this.emit('success', { detail: { page: { props: response.props } } });
    }

    if (typeof options.onFinish === 'function') options.onFinish();
    this.emit('finish', { detail: { visit: req } });

    return response;
  }

  async get(url, data, options = {}) {
    return this.visit(url, { ...options, method: 'get', data });
  }

  async post(url, data, options = {}) {
    return this.visit(url, { ...options, method: 'post', data });
  }

  async put(url, data, options = {}) {
    return this.visit(url, { ...options, method: 'put', data });
  }

  async delete(url, options = {}) {
    return this.visit(url, { ...options, method: 'delete' });
  }

  async reload(options = {}) {
    return this.visit(window.location.href, options);
  }

  clearHistory() {
    this.requests = [];
  }
}

export function mockUseForm(initialData = {}) {
  const form = {
    data: { ...initialData },
    _initial: { ...initialData },
    errors: {},
    processing: false,
    progress: null,
    wasSuccessful: false,
    recentlySuccessful: false,
    recentlySuccessfulTimeout: null,
    transformCallback: null,

    get hasErrors() {
      return Object.keys(this.errors).length > 0;
    },

    get isDirty() {
      return JSON.stringify(this.data) !== JSON.stringify(this._initial);
    },

    transform(callback) {
      this.transformCallback = callback;
      return this;
    },

    reset(...fields) {
      if (fields.length === 0) {
        this.data = { ...this._initial };
      } else {
        for (const f of fields) {
          this.data[f] = this._initial[f];
        }
      }
      return this;
    },

    clearErrors(...fields) {
      if (fields.length === 0) {
        this.errors = {};
      } else {
        for (const f of fields) {
          delete this.errors[f];
        }
      }
      return this;
    },

    setError(fieldOrObject, value) {
      if (typeof fieldOrObject === 'string') {
        this.errors[fieldOrObject] = String(value);
      } else if (typeof fieldOrObject === 'object' && fieldOrObject !== null) {
        Object.assign(this.errors, fieldOrObject);
      }
      return this;
    },

    async submit(method, url, options = {}) {
      this.processing = true;
      this.clearErrors();

      const payload = this.transformCallback ? this.transformCallback(this.data) : this.data;
      if (typeof options.onStart === 'function') options.onStart();

      try {
        // Validation simulation
        const errors = {};
        if (payload.email !== undefined && !payload.email) {
          errors.email = 'The email field is required.';
        }
        if (payload.name !== undefined && !payload.name) {
          errors.name = 'The name field is required.';
        }
        if (payload.message !== undefined && (!payload.message || payload.message.trim().length < 10)) {
          errors.message = 'The message must be at least 10 characters.';
        }

        if (Object.keys(errors).length > 0 && options.forceError !== false) {
          this.setError(errors);
          this.wasSuccessful = false;
          if (typeof options.onError === 'function') options.onError(this.errors);
        } else {
          this.wasSuccessful = true;
          this.recentlySuccessful = true;
          if (typeof options.onSuccess === 'function') {
            options.onSuccess({
              props: {
                flash: {
                  success:
                    'Tín hiệu đã được truyền đi qua màn đêm! Ma Cà Tưng sẽ hồi đáp trong thời gian sớm nhất. ☕✨',
                  reference_id: 'SUMMON-TEST1234'
                }
              }
            });
          }
        }
      } finally {
        this.processing = false;
        if (typeof options.onFinish === 'function') options.onFinish();
      }
      return this;
    },

    async post(url, options = {}) {
      return this.submit('post', url, options);
    },

    async get(url, options = {}) {
      return this.submit('get', url, options);
    },

    async put(url, options = {}) {
      return this.submit('put', url, options);
    },

    async delete(url, options = {}) {
      return this.submit('delete', url, options);
    }
  };

  return form;
}

// ============================================================================
// 6. Environment Setup & Teardown Utilities
// ============================================================================

export function setupTestEnvironment() {
  MockAudioContext.instances = [];
  MockAudioContext.lastInstance = null;
  const mockWindow = new MockWindow();
  const mockDoc = mockWindow.document;
  const mockAudioCtx = new MockAudioContext();
  const mockRouter = new MockInertiaRouter();

  const confettiMock = function (options) {
    confettiMock.calls = confettiMock.calls || [];
    confettiMock.calls.push(options);
    return Promise.resolve();
  };
  confettiMock.calls = [];

  class TestAudioContext extends MockAudioContext {
    constructor(options = {}) {
      super(options);
    }
  }

  mockWindow.AudioContext = TestAudioContext;
  mockWindow.webkitAudioContext = TestAudioContext;
  mockWindow.HTMLCanvasElement = MockHTMLCanvasElement;
  mockWindow.HTMLElement = MockElement;
  mockWindow.Element = MockElement;
  mockWindow.Event = MockEvent;
  mockWindow.CustomEvent = MockCustomEvent;
  mockWindow.MouseEvent = MockMouseEvent;
  mockWindow.KeyboardEvent = MockKeyboardEvent;
  mockWindow.TouchEvent = MockTouchEvent;
  mockWindow.Touch = MockTouch;

  const globalKeys = [
    ['window', mockWindow],
    ['document', mockDoc],
    ['navigator', mockWindow.navigator],
    ['localStorage', mockWindow.localStorage],
    ['sessionStorage', mockWindow.sessionStorage],
    ['AudioContext', TestAudioContext],
    ['webkitAudioContext', TestAudioContext],
    ['HTMLCanvasElement', MockHTMLCanvasElement],
    ['HTMLElement', MockElement],
    ['Element', MockElement],
    ['Event', MockEvent],
    ['CustomEvent', MockCustomEvent],
    ['MouseEvent', MockMouseEvent],
    ['KeyboardEvent', MockKeyboardEvent],
    ['TouchEvent', MockTouchEvent],
    ['Touch', MockTouch],
    ['requestAnimationFrame', mockWindow.requestAnimationFrame.bind(mockWindow)],
    ['cancelAnimationFrame', mockWindow.cancelAnimationFrame.bind(mockWindow)],
    ['getComputedStyle', mockWindow.getComputedStyle.bind(mockWindow)],
    ['matchMedia', mockWindow.matchMedia.bind(mockWindow)],
    ['confetti', confettiMock]
  ];

  const originalDescriptors = new Map();

  for (const [key, value] of globalKeys) {
    originalDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    try {
      Object.defineProperty(globalThis, key, {
        value,
        writable: true,
        configurable: true,
        enumerable: true
      });
    } catch {
      try {
        globalThis[key] = value;
      } catch {
        // Fallback ignore if non-configurable
      }
    }
  }

  const teardown = () => {
    for (const [key] of globalKeys) {
      const desc = originalDescriptors.get(key);
      try {
        if (desc) {
          Object.defineProperty(globalThis, key, desc);
        } else {
          delete globalThis[key];
        }
      } catch {
        // Fallback ignore
      }
    }
  };

  return {
    window: mockWindow,
    document: mockDoc,
    get audioContext() {
      return MockAudioContext.lastInstance || mockAudioCtx;
    },
    localStorage: mockWindow.localStorage,
    sessionStorage: mockWindow.sessionStorage,
    inertiaRouter: mockRouter,
    confetti: confettiMock,
    teardown
  };
}
