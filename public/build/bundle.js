
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element.sheet;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    const managed_styles = new Map();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_style_information(doc, node) {
        const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
        managed_styles.set(doc, info);
        return info;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
        if (!rules[name]) {
            rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            managed_styles.forEach(info => {
                const { stylesheet } = info;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                info.rules = {};
            });
            managed_styles.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    const null_transition = { duration: 0 };
    function create_in_transition(node, fn, params) {
        let config = fn(node, params);
        let running = false;
        let animation_name;
        let task;
        let uid = 0;
        function cleanup() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
            tick(0, 1);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            if (task)
                task.abort();
            running = true;
            add_render_callback(() => dispatch(node, true, 'start'));
            task = loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(1, 0);
                        dispatch(node, true, 'end');
                        cleanup();
                        return running = false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(t, 1 - t);
                    }
                }
                return running;
            });
        }
        let started = false;
        return {
            start() {
                if (started)
                    return;
                started = true;
                delete_rule(node);
                if (is_function(config)) {
                    config = config();
                    wait().then(go);
                }
                else {
                    go();
                }
            },
            invalidate() {
                started = false;
            },
            end() {
                if (running) {
                    cleanup();
                    running = false;
                }
            }
        };
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.49.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }
    function slide(node, { delay = 0, duration = 400, easing = cubicOut } = {}) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => 'overflow: hidden;' +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }
    function scale(node, { delay = 0, duration = 400, easing = cubicOut, start = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const sd = 1 - start;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (_t, u) => `
			transform: ${transform} scale(${1 - (sd * u)});
			opacity: ${target_opacity - (od * u)}
		`
        };
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    var browserPolyfill = createCommonjsModule(function (module, exports) {
    (function (global, factory) {
      {
        factory(module);
      }
    })(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : commonjsGlobal, function (module) {

      if (!globalThis.chrome?.runtime?.id) {
        throw new Error("This script should only be loaded in a browser extension.");
      }

      if (typeof globalThis.browser === "undefined" || Object.getPrototypeOf(globalThis.browser) !== Object.prototype) {
        const CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE = "The message port closed before a response was received."; // Wrapping the bulk of this polyfill in a one-time-use function is a minor
        // optimization for Firefox. Since Spidermonkey does not fully parse the
        // contents of a function until the first time it's called, and since it will
        // never actually need to be called, this allows the polyfill to be included
        // in Firefox nearly for free.

        const wrapAPIs = extensionAPIs => {
          // NOTE: apiMetadata is associated to the content of the api-metadata.json file
          // at build time by replacing the following "include" with the content of the
          // JSON file.
          const apiMetadata = {
            "alarms": {
              "clear": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "clearAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "get": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "getAll": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "bookmarks": {
              "create": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "get": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getChildren": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getRecent": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getSubTree": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getTree": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "move": {
                "minArgs": 2,
                "maxArgs": 2
              },
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeTree": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "search": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "update": {
                "minArgs": 2,
                "maxArgs": 2
              }
            },
            "browserAction": {
              "disable": {
                "minArgs": 0,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "enable": {
                "minArgs": 0,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "getBadgeBackgroundColor": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getBadgeText": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getPopup": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getTitle": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "openPopup": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "setBadgeBackgroundColor": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "setBadgeText": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "setIcon": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "setPopup": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "setTitle": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              }
            },
            "browsingData": {
              "remove": {
                "minArgs": 2,
                "maxArgs": 2
              },
              "removeCache": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeCookies": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeDownloads": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeFormData": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeHistory": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeLocalStorage": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removePasswords": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removePluginData": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "settings": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "commands": {
              "getAll": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "contextMenus": {
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "update": {
                "minArgs": 2,
                "maxArgs": 2
              }
            },
            "cookies": {
              "get": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getAll": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getAllCookieStores": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "set": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "devtools": {
              "inspectedWindow": {
                "eval": {
                  "minArgs": 1,
                  "maxArgs": 2,
                  "singleCallbackArg": false
                }
              },
              "panels": {
                "create": {
                  "minArgs": 3,
                  "maxArgs": 3,
                  "singleCallbackArg": true
                },
                "elements": {
                  "createSidebarPane": {
                    "minArgs": 1,
                    "maxArgs": 1
                  }
                }
              }
            },
            "downloads": {
              "cancel": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "download": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "erase": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getFileIcon": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "open": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "pause": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeFile": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "resume": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "search": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "show": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              }
            },
            "extension": {
              "isAllowedFileSchemeAccess": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "isAllowedIncognitoAccess": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "history": {
              "addUrl": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "deleteAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "deleteRange": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "deleteUrl": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getVisits": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "search": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "i18n": {
              "detectLanguage": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getAcceptLanguages": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "identity": {
              "launchWebAuthFlow": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "idle": {
              "queryState": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "management": {
              "get": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "getSelf": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "setEnabled": {
                "minArgs": 2,
                "maxArgs": 2
              },
              "uninstallSelf": {
                "minArgs": 0,
                "maxArgs": 1
              }
            },
            "notifications": {
              "clear": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "create": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "getAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "getPermissionLevel": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "update": {
                "minArgs": 2,
                "maxArgs": 2
              }
            },
            "pageAction": {
              "getPopup": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getTitle": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "hide": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "setIcon": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "setPopup": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "setTitle": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              },
              "show": {
                "minArgs": 1,
                "maxArgs": 1,
                "fallbackToNoCallback": true
              }
            },
            "permissions": {
              "contains": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getAll": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "request": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "runtime": {
              "getBackgroundPage": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "getPlatformInfo": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "openOptionsPage": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "requestUpdateCheck": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "sendMessage": {
                "minArgs": 1,
                "maxArgs": 3
              },
              "sendNativeMessage": {
                "minArgs": 2,
                "maxArgs": 2
              },
              "setUninstallURL": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "sessions": {
              "getDevices": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "getRecentlyClosed": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "restore": {
                "minArgs": 0,
                "maxArgs": 1
              }
            },
            "storage": {
              "local": {
                "clear": {
                  "minArgs": 0,
                  "maxArgs": 0
                },
                "get": {
                  "minArgs": 0,
                  "maxArgs": 1
                },
                "getBytesInUse": {
                  "minArgs": 0,
                  "maxArgs": 1
                },
                "remove": {
                  "minArgs": 1,
                  "maxArgs": 1
                },
                "set": {
                  "minArgs": 1,
                  "maxArgs": 1
                }
              },
              "managed": {
                "get": {
                  "minArgs": 0,
                  "maxArgs": 1
                },
                "getBytesInUse": {
                  "minArgs": 0,
                  "maxArgs": 1
                }
              },
              "sync": {
                "clear": {
                  "minArgs": 0,
                  "maxArgs": 0
                },
                "get": {
                  "minArgs": 0,
                  "maxArgs": 1
                },
                "getBytesInUse": {
                  "minArgs": 0,
                  "maxArgs": 1
                },
                "remove": {
                  "minArgs": 1,
                  "maxArgs": 1
                },
                "set": {
                  "minArgs": 1,
                  "maxArgs": 1
                }
              }
            },
            "tabs": {
              "captureVisibleTab": {
                "minArgs": 0,
                "maxArgs": 2
              },
              "create": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "detectLanguage": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "discard": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "duplicate": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "executeScript": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "get": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getCurrent": {
                "minArgs": 0,
                "maxArgs": 0
              },
              "getZoom": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "getZoomSettings": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "goBack": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "goForward": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "highlight": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "insertCSS": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "move": {
                "minArgs": 2,
                "maxArgs": 2
              },
              "query": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "reload": {
                "minArgs": 0,
                "maxArgs": 2
              },
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "removeCSS": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "sendMessage": {
                "minArgs": 2,
                "maxArgs": 3
              },
              "setZoom": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "setZoomSettings": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "update": {
                "minArgs": 1,
                "maxArgs": 2
              }
            },
            "topSites": {
              "get": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "webNavigation": {
              "getAllFrames": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "getFrame": {
                "minArgs": 1,
                "maxArgs": 1
              }
            },
            "webRequest": {
              "handlerBehaviorChanged": {
                "minArgs": 0,
                "maxArgs": 0
              }
            },
            "windows": {
              "create": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "get": {
                "minArgs": 1,
                "maxArgs": 2
              },
              "getAll": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "getCurrent": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "getLastFocused": {
                "minArgs": 0,
                "maxArgs": 1
              },
              "remove": {
                "minArgs": 1,
                "maxArgs": 1
              },
              "update": {
                "minArgs": 2,
                "maxArgs": 2
              }
            }
          };

          if (Object.keys(apiMetadata).length === 0) {
            throw new Error("api-metadata.json has not been included in browser-polyfill");
          }
          /**
           * A WeakMap subclass which creates and stores a value for any key which does
           * not exist when accessed, but behaves exactly as an ordinary WeakMap
           * otherwise.
           *
           * @param {function} createItem
           *        A function which will be called in order to create the value for any
           *        key which does not exist, the first time it is accessed. The
           *        function receives, as its only argument, the key being created.
           */


          class DefaultWeakMap extends WeakMap {
            constructor(createItem, items = undefined) {
              super(items);
              this.createItem = createItem;
            }

            get(key) {
              if (!this.has(key)) {
                this.set(key, this.createItem(key));
              }

              return super.get(key);
            }

          }
          /**
           * Returns true if the given object is an object with a `then` method, and can
           * therefore be assumed to behave as a Promise.
           *
           * @param {*} value The value to test.
           * @returns {boolean} True if the value is thenable.
           */


          const isThenable = value => {
            return value && typeof value === "object" && typeof value.then === "function";
          };
          /**
           * Creates and returns a function which, when called, will resolve or reject
           * the given promise based on how it is called:
           *
           * - If, when called, `chrome.runtime.lastError` contains a non-null object,
           *   the promise is rejected with that value.
           * - If the function is called with exactly one argument, the promise is
           *   resolved to that value.
           * - Otherwise, the promise is resolved to an array containing all of the
           *   function's arguments.
           *
           * @param {object} promise
           *        An object containing the resolution and rejection functions of a
           *        promise.
           * @param {function} promise.resolve
           *        The promise's resolution function.
           * @param {function} promise.reject
           *        The promise's rejection function.
           * @param {object} metadata
           *        Metadata about the wrapped method which has created the callback.
           * @param {boolean} metadata.singleCallbackArg
           *        Whether or not the promise is resolved with only the first
           *        argument of the callback, alternatively an array of all the
           *        callback arguments is resolved. By default, if the callback
           *        function is invoked with only a single argument, that will be
           *        resolved to the promise, while all arguments will be resolved as
           *        an array if multiple are given.
           *
           * @returns {function}
           *        The generated callback function.
           */


          const makeCallback = (promise, metadata) => {
            return (...callbackArgs) => {
              if (extensionAPIs.runtime.lastError) {
                promise.reject(new Error(extensionAPIs.runtime.lastError.message));
              } else if (metadata.singleCallbackArg || callbackArgs.length <= 1 && metadata.singleCallbackArg !== false) {
                promise.resolve(callbackArgs[0]);
              } else {
                promise.resolve(callbackArgs);
              }
            };
          };

          const pluralizeArguments = numArgs => numArgs == 1 ? "argument" : "arguments";
          /**
           * Creates a wrapper function for a method with the given name and metadata.
           *
           * @param {string} name
           *        The name of the method which is being wrapped.
           * @param {object} metadata
           *        Metadata about the method being wrapped.
           * @param {integer} metadata.minArgs
           *        The minimum number of arguments which must be passed to the
           *        function. If called with fewer than this number of arguments, the
           *        wrapper will raise an exception.
           * @param {integer} metadata.maxArgs
           *        The maximum number of arguments which may be passed to the
           *        function. If called with more than this number of arguments, the
           *        wrapper will raise an exception.
           * @param {boolean} metadata.singleCallbackArg
           *        Whether or not the promise is resolved with only the first
           *        argument of the callback, alternatively an array of all the
           *        callback arguments is resolved. By default, if the callback
           *        function is invoked with only a single argument, that will be
           *        resolved to the promise, while all arguments will be resolved as
           *        an array if multiple are given.
           *
           * @returns {function(object, ...*)}
           *       The generated wrapper function.
           */


          const wrapAsyncFunction = (name, metadata) => {
            return function asyncFunctionWrapper(target, ...args) {
              if (args.length < metadata.minArgs) {
                throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
              }

              if (args.length > metadata.maxArgs) {
                throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
              }

              return new Promise((resolve, reject) => {
                if (metadata.fallbackToNoCallback) {
                  // This API method has currently no callback on Chrome, but it return a promise on Firefox,
                  // and so the polyfill will try to call it with a callback first, and it will fallback
                  // to not passing the callback if the first call fails.
                  try {
                    target[name](...args, makeCallback({
                      resolve,
                      reject
                    }, metadata));
                  } catch (cbError) {
                    console.warn(`${name} API method doesn't seem to support the callback parameter, ` + "falling back to call it without a callback: ", cbError);
                    target[name](...args); // Update the API method metadata, so that the next API calls will not try to
                    // use the unsupported callback anymore.

                    metadata.fallbackToNoCallback = false;
                    metadata.noCallback = true;
                    resolve();
                  }
                } else if (metadata.noCallback) {
                  target[name](...args);
                  resolve();
                } else {
                  target[name](...args, makeCallback({
                    resolve,
                    reject
                  }, metadata));
                }
              });
            };
          };
          /**
           * Wraps an existing method of the target object, so that calls to it are
           * intercepted by the given wrapper function. The wrapper function receives,
           * as its first argument, the original `target` object, followed by each of
           * the arguments passed to the original method.
           *
           * @param {object} target
           *        The original target object that the wrapped method belongs to.
           * @param {function} method
           *        The method being wrapped. This is used as the target of the Proxy
           *        object which is created to wrap the method.
           * @param {function} wrapper
           *        The wrapper function which is called in place of a direct invocation
           *        of the wrapped method.
           *
           * @returns {Proxy<function>}
           *        A Proxy object for the given method, which invokes the given wrapper
           *        method in its place.
           */


          const wrapMethod = (target, method, wrapper) => {
            return new Proxy(method, {
              apply(targetMethod, thisObj, args) {
                return wrapper.call(thisObj, target, ...args);
              }

            });
          };

          let hasOwnProperty = Function.call.bind(Object.prototype.hasOwnProperty);
          /**
           * Wraps an object in a Proxy which intercepts and wraps certain methods
           * based on the given `wrappers` and `metadata` objects.
           *
           * @param {object} target
           *        The target object to wrap.
           *
           * @param {object} [wrappers = {}]
           *        An object tree containing wrapper functions for special cases. Any
           *        function present in this object tree is called in place of the
           *        method in the same location in the `target` object tree. These
           *        wrapper methods are invoked as described in {@see wrapMethod}.
           *
           * @param {object} [metadata = {}]
           *        An object tree containing metadata used to automatically generate
           *        Promise-based wrapper functions for asynchronous. Any function in
           *        the `target` object tree which has a corresponding metadata object
           *        in the same location in the `metadata` tree is replaced with an
           *        automatically-generated wrapper function, as described in
           *        {@see wrapAsyncFunction}
           *
           * @returns {Proxy<object>}
           */

          const wrapObject = (target, wrappers = {}, metadata = {}) => {
            let cache = Object.create(null);
            let handlers = {
              has(proxyTarget, prop) {
                return prop in target || prop in cache;
              },

              get(proxyTarget, prop, receiver) {
                if (prop in cache) {
                  return cache[prop];
                }

                if (!(prop in target)) {
                  return undefined;
                }

                let value = target[prop];

                if (typeof value === "function") {
                  // This is a method on the underlying object. Check if we need to do
                  // any wrapping.
                  if (typeof wrappers[prop] === "function") {
                    // We have a special-case wrapper for this method.
                    value = wrapMethod(target, target[prop], wrappers[prop]);
                  } else if (hasOwnProperty(metadata, prop)) {
                    // This is an async method that we have metadata for. Create a
                    // Promise wrapper for it.
                    let wrapper = wrapAsyncFunction(prop, metadata[prop]);
                    value = wrapMethod(target, target[prop], wrapper);
                  } else {
                    // This is a method that we don't know or care about. Return the
                    // original method, bound to the underlying object.
                    value = value.bind(target);
                  }
                } else if (typeof value === "object" && value !== null && (hasOwnProperty(wrappers, prop) || hasOwnProperty(metadata, prop))) {
                  // This is an object that we need to do some wrapping for the children
                  // of. Create a sub-object wrapper for it with the appropriate child
                  // metadata.
                  value = wrapObject(value, wrappers[prop], metadata[prop]);
                } else if (hasOwnProperty(metadata, "*")) {
                  // Wrap all properties in * namespace.
                  value = wrapObject(value, wrappers[prop], metadata["*"]);
                } else {
                  // We don't need to do any wrapping for this property,
                  // so just forward all access to the underlying object.
                  Object.defineProperty(cache, prop, {
                    configurable: true,
                    enumerable: true,

                    get() {
                      return target[prop];
                    },

                    set(value) {
                      target[prop] = value;
                    }

                  });
                  return value;
                }

                cache[prop] = value;
                return value;
              },

              set(proxyTarget, prop, value, receiver) {
                if (prop in cache) {
                  cache[prop] = value;
                } else {
                  target[prop] = value;
                }

                return true;
              },

              defineProperty(proxyTarget, prop, desc) {
                return Reflect.defineProperty(cache, prop, desc);
              },

              deleteProperty(proxyTarget, prop) {
                return Reflect.deleteProperty(cache, prop);
              }

            }; // Per contract of the Proxy API, the "get" proxy handler must return the
            // original value of the target if that value is declared read-only and
            // non-configurable. For this reason, we create an object with the
            // prototype set to `target` instead of using `target` directly.
            // Otherwise we cannot return a custom object for APIs that
            // are declared read-only and non-configurable, such as `chrome.devtools`.
            //
            // The proxy handlers themselves will still use the original `target`
            // instead of the `proxyTarget`, so that the methods and properties are
            // dereferenced via the original targets.

            let proxyTarget = Object.create(target);
            return new Proxy(proxyTarget, handlers);
          };
          /**
           * Creates a set of wrapper functions for an event object, which handles
           * wrapping of listener functions that those messages are passed.
           *
           * A single wrapper is created for each listener function, and stored in a
           * map. Subsequent calls to `addListener`, `hasListener`, or `removeListener`
           * retrieve the original wrapper, so that  attempts to remove a
           * previously-added listener work as expected.
           *
           * @param {DefaultWeakMap<function, function>} wrapperMap
           *        A DefaultWeakMap object which will create the appropriate wrapper
           *        for a given listener function when one does not exist, and retrieve
           *        an existing one when it does.
           *
           * @returns {object}
           */


          const wrapEvent = wrapperMap => ({
            addListener(target, listener, ...args) {
              target.addListener(wrapperMap.get(listener), ...args);
            },

            hasListener(target, listener) {
              return target.hasListener(wrapperMap.get(listener));
            },

            removeListener(target, listener) {
              target.removeListener(wrapperMap.get(listener));
            }

          });

          const onRequestFinishedWrappers = new DefaultWeakMap(listener => {
            if (typeof listener !== "function") {
              return listener;
            }
            /**
             * Wraps an onRequestFinished listener function so that it will return a
             * `getContent()` property which returns a `Promise` rather than using a
             * callback API.
             *
             * @param {object} req
             *        The HAR entry object representing the network request.
             */


            return function onRequestFinished(req) {
              const wrappedReq = wrapObject(req, {}
              /* wrappers */
              , {
                getContent: {
                  minArgs: 0,
                  maxArgs: 0
                }
              });
              listener(wrappedReq);
            };
          });
          const onMessageWrappers = new DefaultWeakMap(listener => {
            if (typeof listener !== "function") {
              return listener;
            }
            /**
             * Wraps a message listener function so that it may send responses based on
             * its return value, rather than by returning a sentinel value and calling a
             * callback. If the listener function returns a Promise, the response is
             * sent when the promise either resolves or rejects.
             *
             * @param {*} message
             *        The message sent by the other end of the channel.
             * @param {object} sender
             *        Details about the sender of the message.
             * @param {function(*)} sendResponse
             *        A callback which, when called with an arbitrary argument, sends
             *        that value as a response.
             * @returns {boolean}
             *        True if the wrapped listener returned a Promise, which will later
             *        yield a response. False otherwise.
             */


            return function onMessage(message, sender, sendResponse) {
              let didCallSendResponse = false;
              let wrappedSendResponse;
              let sendResponsePromise = new Promise(resolve => {
                wrappedSendResponse = function (response) {
                  didCallSendResponse = true;
                  resolve(response);
                };
              });
              let result;

              try {
                result = listener(message, sender, wrappedSendResponse);
              } catch (err) {
                result = Promise.reject(err);
              }

              const isResultThenable = result !== true && isThenable(result); // If the listener didn't returned true or a Promise, or called
              // wrappedSendResponse synchronously, we can exit earlier
              // because there will be no response sent from this listener.

              if (result !== true && !isResultThenable && !didCallSendResponse) {
                return false;
              } // A small helper to send the message if the promise resolves
              // and an error if the promise rejects (a wrapped sendMessage has
              // to translate the message into a resolved promise or a rejected
              // promise).


              const sendPromisedResult = promise => {
                promise.then(msg => {
                  // send the message value.
                  sendResponse(msg);
                }, error => {
                  // Send a JSON representation of the error if the rejected value
                  // is an instance of error, or the object itself otherwise.
                  let message;

                  if (error && (error instanceof Error || typeof error.message === "string")) {
                    message = error.message;
                  } else {
                    message = "An unexpected error occurred";
                  }

                  sendResponse({
                    __mozWebExtensionPolyfillReject__: true,
                    message
                  });
                }).catch(err => {
                  // Print an error on the console if unable to send the response.
                  console.error("Failed to send onMessage rejected reply", err);
                });
              }; // If the listener returned a Promise, send the resolved value as a
              // result, otherwise wait the promise related to the wrappedSendResponse
              // callback to resolve and send it as a response.


              if (isResultThenable) {
                sendPromisedResult(result);
              } else {
                sendPromisedResult(sendResponsePromise);
              } // Let Chrome know that the listener is replying.


              return true;
            };
          });

          const wrappedSendMessageCallback = ({
            reject,
            resolve
          }, reply) => {
            if (extensionAPIs.runtime.lastError) {
              // Detect when none of the listeners replied to the sendMessage call and resolve
              // the promise to undefined as in Firefox.
              // See https://github.com/mozilla/webextension-polyfill/issues/130
              if (extensionAPIs.runtime.lastError.message === CHROME_SEND_MESSAGE_CALLBACK_NO_RESPONSE_MESSAGE) {
                resolve();
              } else {
                reject(new Error(extensionAPIs.runtime.lastError.message));
              }
            } else if (reply && reply.__mozWebExtensionPolyfillReject__) {
              // Convert back the JSON representation of the error into
              // an Error instance.
              reject(new Error(reply.message));
            } else {
              resolve(reply);
            }
          };

          const wrappedSendMessage = (name, metadata, apiNamespaceObj, ...args) => {
            if (args.length < metadata.minArgs) {
              throw new Error(`Expected at least ${metadata.minArgs} ${pluralizeArguments(metadata.minArgs)} for ${name}(), got ${args.length}`);
            }

            if (args.length > metadata.maxArgs) {
              throw new Error(`Expected at most ${metadata.maxArgs} ${pluralizeArguments(metadata.maxArgs)} for ${name}(), got ${args.length}`);
            }

            return new Promise((resolve, reject) => {
              const wrappedCb = wrappedSendMessageCallback.bind(null, {
                resolve,
                reject
              });
              args.push(wrappedCb);
              apiNamespaceObj.sendMessage(...args);
            });
          };

          const staticWrappers = {
            devtools: {
              network: {
                onRequestFinished: wrapEvent(onRequestFinishedWrappers)
              }
            },
            runtime: {
              onMessage: wrapEvent(onMessageWrappers),
              onMessageExternal: wrapEvent(onMessageWrappers),
              sendMessage: wrappedSendMessage.bind(null, "sendMessage", {
                minArgs: 1,
                maxArgs: 3
              })
            },
            tabs: {
              sendMessage: wrappedSendMessage.bind(null, "sendMessage", {
                minArgs: 2,
                maxArgs: 3
              })
            }
          };
          const settingMetadata = {
            clear: {
              minArgs: 1,
              maxArgs: 1
            },
            get: {
              minArgs: 1,
              maxArgs: 1
            },
            set: {
              minArgs: 1,
              maxArgs: 1
            }
          };
          apiMetadata.privacy = {
            network: {
              "*": settingMetadata
            },
            services: {
              "*": settingMetadata
            },
            websites: {
              "*": settingMetadata
            }
          };
          return wrapObject(extensionAPIs, staticWrappers, apiMetadata);
        }; // The build process adds a UMD wrapper around this file, which makes the
        // `module` variable available.


        module.exports = wrapAPIs(chrome);
      } else {
        module.exports = globalThis.browser;
      }
    });

    });

    var chromeStorageStoreAdapter = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.chromeStorageManaged = exports.chromeStorageSync = exports.chromeStorageLocal = void 0;
    var adapters = {
        sync: {},
        local: {},
        managed: {},
    };
    if (!chrome.storage) {
        throw new Error("You are missing the `storage` permission in your manifest.");
    }
    chrome.storage.onChanged.addListener(function (changes, area) {
        // I'm not sure if or when this is the case, but rather be safe than sorry.
        if (area == 'session')
            return;
        var areaAdapters = adapters[area];
        Object.entries(changes).forEach(function (_a) {
            var _b;
            var key = _a[0], value = _a[1];
            (_b = areaAdapters[key]) === null || _b === void 0 ? void 0 : _b.forEach(function (run) { return run(value.newValue); });
        });
    });
    /**
     * Creates a new {@link ChromeStorageStoreAdapter} for a given key.
     * Data will be published to/read from chrome.storage.local.
     * This is a {@link Writable} instance, and can be used in place of
     * svelte stores.
     * @param key The key to store in the `local` chrome storage area.
     * @throws If the `storage` permission is not present in your manifest.
     * */
    function chromeStorageLocal(key) {
        return new ChromeStorageStoreAdapter('local', key);
    }
    exports.chromeStorageLocal = chromeStorageLocal;
    /**
     * Creates a new {@link ChromeStorageStoreAdapter} for a given key.
     * Data will be published to/read from chrome.storage.sync.
     * This is a {@link Writable} instance, and can be used in place of
     * svelte stores.
     * @param key The key to store in the `sync` chrome storage area.
     * @throws If the `storage` permission is not present in your manifest.
     * */
    function chromeStorageSync(key) {
        return new ChromeStorageStoreAdapter('sync', key);
    }
    exports.chromeStorageSync = chromeStorageSync;
    /**
     * Creates a new {@link ChromeStorageStoreAdapter} for a given key.
     * Data will be read from chrome.storage.managed.
     * This is a {@link Writable} instance, and can be used in place of
     * svelte stores.
     *
     * NOTE: You cannot write to a managed storage area; it is read-only.
     * @param key The key to read from the `managed` chrome storage area.
     * @throws If the `storage` permission is not present in your manifest.
     * @throws If you try to write to this storage area.
     * */
    function chromeStorageManaged(key) {
        return new ChromeStorageStoreAdapter('managed', key);
    }
    exports.chromeStorageManaged = chromeStorageManaged;
    /**
     * {@link Writable} implementation that delegates to a chrome storage area.
     * */
    var ChromeStorageStoreAdapter = /** @class */ (function () {
        function ChromeStorageStoreAdapter(area, key) {
            this.area = area;
            this.key = key;
            this.storageArea = chrome.storage[this.area];
        }
        ChromeStorageStoreAdapter.prototype.set = function (value) {
            var _a;
            if (this.area === 'managed') {
                throw Error("Cannot set managed area");
            }
            this.storageArea.set((_a = {}, _a[this.key] = value, _a));
        };
        ChromeStorageStoreAdapter.prototype.subscribe = function (run) {
            var _this = this;
            var _a;
            var subscriberArray = (_a = adapters[this.area][this.key]) !== null && _a !== void 0 ? _a : (adapters[this.area][this.key] = []);
            subscriberArray.push(run);
            this.storageArea.get(this.key, function (item) {
                run(item[_this.key]);
            });
            return function () { return subscriberArray.splice(subscriberArray.indexOf(run), 1); };
        };
        ChromeStorageStoreAdapter.prototype.update = function (updater) {
            var _this = this;
            this.storageArea.get(this.key, function (item) {
                var newItem = updater(item[_this.key]);
                _this.set(newItem);
            });
        };
        return ChromeStorageStoreAdapter;
    }());
    });

    var dist = createCommonjsModule(function (module, exports) {
    var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }));
    var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    __exportStar(chromeStorageStoreAdapter, exports);
    });

    /* src\Dashboard.svelte generated by Svelte v3.49.0 */
    const file$1 = "src\\Dashboard.svelte";

    function create_fragment$1(ctx) {
    	let h1;
    	let t0;
    	let t1;
    	let t2;
    	let h2;
    	let t3;
    	let t4;
    	let t5;
    	let br;
    	let t6;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			h1 = element("h1");
    			t0 = text("Welcome Back! ");
    			t1 = text(/*name*/ ctx[0]);
    			t2 = space();
    			h2 = element("h2");
    			t3 = text("username: ");
    			t4 = text(/*username*/ ctx[1]);
    			t5 = space();
    			br = element("br");
    			t6 = space();
    			button = element("button");
    			button.textContent = "Logout";
    			add_location(h1, file$1, 13, 0, 281);
    			add_location(h2, file$1, 14, 0, 313);
    			add_location(br, file$1, 15, 0, 344);
    			add_location(button, file$1, 16, 0, 350);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, h2, anchor);
    			append_dev(h2, t3);
    			append_dev(h2, t4);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, br, anchor);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*logout*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t1, /*name*/ ctx[0]);
    			if (dirty & /*username*/ 2) set_data_dev(t4, /*username*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(br);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Dashboard', slots, []);
    	const dispatch = createEventDispatcher();
    	let { name } = $$props;
    	let { username } = $$props;

    	const logout = () => {
    		dispatch("logout", { timestamp: Date.now() });
    	};

    	const writable_props = ['name', 'username'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Dashboard> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('username' in $$props) $$invalidate(1, username = $$props.username);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		name,
    		username,
    		logout
    	});

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('username' in $$props) $$invalidate(1, username = $$props.username);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [name, username, logout];
    }

    class Dashboard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { name: 0, username: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Dashboard",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !('name' in props)) {
    			console.warn("<Dashboard> was created without expected prop 'name'");
    		}

    		if (/*username*/ ctx[1] === undefined && !('username' in props)) {
    			console.warn("<Dashboard> was created without expected prop 'username'");
    		}
    	}

    	get name() {
    		throw new Error("<Dashboard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Dashboard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get username() {
    		throw new Error("<Dashboard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set username(value) {
    		throw new Error("<Dashboard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.49.0 */
    const file = "src\\App.svelte";

    // (23:2) {:else}
    function create_else_block(ctx) {
    	let button;
    	let button_intro;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Login";
    			add_location(button, file, 23, 2, 536);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: function intro(local) {
    			if (!button_intro) {
    				add_render_callback(() => {
    					button_intro = create_in_transition(button, fly, { x: 200 });
    					button_intro.start();
    				});
    			}
    		},
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(23:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (19:2) {#if user.loggedin}
    function create_if_block(ctx) {
    	let div;
    	let dashboard;
    	let div_intro;
    	let current;
    	const dashboard_spread_levels = [/*user*/ ctx[0]];
    	let dashboard_props = {};

    	for (let i = 0; i < dashboard_spread_levels.length; i += 1) {
    		dashboard_props = assign(dashboard_props, dashboard_spread_levels[i]);
    	}

    	dashboard = new Dashboard({ props: dashboard_props, $$inline: true });
    	dashboard.$on("logout", /*logout_handler*/ ctx[1]);

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(dashboard.$$.fragment);
    			add_location(div, file, 19, 2, 439);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(dashboard, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const dashboard_changes = (dirty & /*user*/ 1)
    			? get_spread_update(dashboard_spread_levels, [get_spread_object(/*user*/ ctx[0])])
    			: {};

    			dashboard.$set(dashboard_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(dashboard.$$.fragment, local);

    			if (!div_intro) {
    				add_render_callback(() => {
    					div_intro = create_in_transition(div, fade, {});
    					div_intro.start();
    				});
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(dashboard.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(dashboard);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(19:2) {#if user.loggedin}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let a;
    	let button;
    	let t1;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*user*/ ctx[0].loggedin) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			a = element("a");
    			button = element("button");
    			button.textContent = "Login with Github";
    			t1 = space();
    			if_block.c();
    			add_location(button, file, 16, 4, 373);
    			attr_dev(a, "href", "/Login");
    			add_location(a, file, 15, 2, 351);
    			attr_dev(main, "class", "svelte-lt0lut");
    			add_location(main, file, 14, 0, 342);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, a);
    			append_dev(a, button);
    			append_dev(main, t1);
    			if_blocks[current_block_type_index].m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(main, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let user = dist.chromeStorageLocal("user");
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const logout_handler = () => $$invalidate(0, user.loggedin = false, user);
    	const click_handler = () => $$invalidate(0, user.loggedin = true, user);

    	$$self.$capture_state = () => ({
    		fade,
    		fly,
    		scale,
    		slide,
    		browser: browserPolyfill,
    		chromeStorageLocal: dist.chromeStorageLocal,
    		Dashboard,
    		user
    	});

    	$$self.$inject_state = $$props => {
    		if ('user' in $$props) $$invalidate(0, user = $$props.user);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$invalidate(0, user = {
    		name: "Rohit",
    		username: "rb",
    		loggedin: false
    	});

    	return [user, logout_handler, click_handler];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
