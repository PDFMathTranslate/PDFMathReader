import {
  defineComponent,
  h,
  nextTick,
  normalizeClass,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

/*
 * Fluent UI Web Components 3.x registers each element through a side-effect
 * module. Keep these imports behind the Windows adapter so the MacVue branch
 * does not add a Fluent request or registration side effect.
 *
 * Fluent 3.1 uses FluentDesignSystem.registry for the custom-element registry
 * and setTheme for its design tokens. That is the v3 equivalent of the older
 * provideFluentDesignSystem registration API.
 */
let fluentReady;
let themeObserver;
let themeMediaQuery;
let themeApply;
let appliedThemeKey;

function fluentImports() {
  return Promise.all([
    import('@fluentui/web-components/button.js'),
    import('@fluentui/web-components/switch.js'),
    import('@fluentui/web-components/slider.js'),
    import('@fluentui/web-components/dropdown.js'),
    import('@fluentui/web-components/listbox.js'),
    import('@fluentui/web-components/option.js'),
    import('@fluentui/web-components/tab.js'),
    import('@fluentui/web-components/tablist.js'),
    import('@fluentui/web-components/text-input.js'),
  ]);
}

function isDarkAppearance() {
  const root = document.documentElement;
  const appearance = root.dataset.appearance || root.dataset.macvueAppearance;
  if (appearance === 'dark') return true;
  if (appearance === 'light') return false;
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

function accentColor() {
  const value = document.documentElement.style.getPropertyValue('--accent').trim();
  return /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value) ? value : '';
}

function themeFor(light, dark) {
  const base = isDarkAppearance() ? dark : light;
  const accent = accentColor();
  if (!accent) return base;

  // Keep Fluent's complete light/dark token set while following the app's
  // existing accent setting for primary buttons and brand interaction states.
  const pressed = `color-mix(in srgb, ${accent} 82%, #000)`;
  const hover = `color-mix(in srgb, ${accent} 90%, #fff)`;
  return {
    ...base,
    colorBrandBackground: accent,
    colorBrandBackgroundHover: hover,
    colorBrandBackgroundPressed: pressed,
    colorBrandBackgroundSelected: accent,
    colorCompoundBrandBackground: accent,
    colorCompoundBrandBackgroundHover: hover,
    colorCompoundBrandBackgroundPressed: pressed,
    colorBrandForeground1: accent,
    colorBrandForeground2: pressed,
    colorBrandStroke1: accent,
    colorCompoundBrandStroke: accent,
  };
}

async function installTheme() {
  if (typeof document === 'undefined') return;
  const [{ setTheme }, { webLightTheme, webDarkTheme }] = await Promise.all([
    import('@fluentui/web-components/theme/set-theme.js'),
    import('@fluentui/tokens'),
  ]);

  const apply = () => {
    const root = document.documentElement;
    const key = `${isDarkAppearance() ? 'dark' : 'light'}|${accentColor()}|${root.dataset.appearance || ''}|${root.dataset.macvueAppearance || ''}`;
    if (key === appliedThemeKey) return;
    appliedThemeKey = key;
    setTheme(themeFor(webLightTheme, webDarkTheme), document);
  };
  themeApply = apply;
  apply();

  if (themeObserver) return;
  themeObserver = new MutationObserver(apply);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-appearance', 'data-macvue-appearance', 'style'],
  });
  themeMediaQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
  themeMediaQuery?.addEventListener?.('change', apply);
  themeMediaQuery?.addListener?.(apply);
}

export function ensureFluent() {
  if (!fluentReady) {
    fluentReady = fluentImports().then(installTheme);
  }
  return fluentReady;
}

function invoke(listener, event) {
  if (Array.isArray(listener)) {
    listener.forEach((entry) => invoke(entry, event));
  } else if (typeof listener === 'function') {
    listener(event);
  }
}

function withListener(attrs, name, handler) {
  const listener = attrs[name];
  return {
    ...attrs,
    [name]: listener
      ? (event) => {
          invoke(listener, event);
          handler(event);
        }
      : handler,
  };
}

function controlAttrs(attrs, ...classes) {
  const forwarded = { ...attrs };
  delete forwarded['onUpdate:modelValue'];
  delete forwarded['onUpdate:open'];
  delete forwarded.modelValue;
  delete forwarded.open;
  if (classes.length) forwarded.class = [...classes, forwarded.class].filter(Boolean);
  return forwarded;
}

function buttonSize(size) {
  if (size === 'small' || size === 'mini') return 'small';
  if (size === 'large' || size === 'extra-large') return 'large';
  return 'medium';
}

function booleanAttribute(value) {
  return value ? true : undefined;
}

function segmentSize(size) {
  if (size === 'small' || size === 'mini') return 'small';
  if (size === 'large' || size === 'extra-large') return 'large';
  return 'medium';
}

function invokeFocus(element, method) {
  if (!element) return;
  element[method]?.();
}

function exposeControl(expose, element, input = element) {
  expose({
    el: element,
    input,
    focus: () => invokeFocus(input.value || element.value, 'focus'),
    blur: () => invokeFocus(input.value || element.value, 'blur'),
  });
}

export const AppButton = defineComponent({
  name: 'WindowsButton',
  inheritAttrs: false,
  props: {
    size: { default: 'regular' },
    variant: { default: 'default' },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { attrs, slots, expose }) {
    const element = ref(null);
    onMounted(() => {
      void ensureFluent();
    });
    exposeControl(expose, element);
    return () =>
      h(
        'fluent-button',
        {
          ...controlAttrs(attrs, 'macvue-button'),
          ref: element,
          appearance: props.variant === 'prominent' ? 'primary' : 'subtle',
          size: buttonSize(props.size),
          'icon-only': booleanAttribute(
            normalizeClass(attrs.class).split(/\s+/).includes('icon-button'),
          ),
          type: attrs.type || 'button',
          disabled: booleanAttribute(props.disabled),
        },
        slots.default?.(),
      );
  },
});

export const AppSwitch = defineComponent({
  name: 'WindowsSwitch',
  inheritAttrs: false,
  props: {
    modelValue: { default: undefined },
    defaultValue: { default: undefined },
    size: { default: 'regular' },
    disabled: { type: Boolean, default: false },
    name: { default: undefined },
    value: { default: 'on' },
    required: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit, expose, slots }) {
    const element = ref(null);
    const localValue = ref(props.defaultValue ?? false);
    const currentValue = () =>
      props.modelValue === undefined ? localValue.value : Boolean(props.modelValue);
    const sync = () => {
      if (!element.value) return;
      element.value.checked = currentValue();
      element.value.disabled = props.disabled;
      if (props.name !== undefined) element.value.name = props.name;
      element.value.value = props.value;
      element.value.required = props.required;
    };
    const change = (event) => {
      const value = Boolean(event.currentTarget?.checked ?? event.target?.checked);
      localValue.value = value;
      emit('update:modelValue', value);
    };
    onMounted(() => {
      void ensureFluent().then(sync);
    });
    watch(() => [props.modelValue, props.disabled, props.name, props.value, props.required], sync);
    exposeControl(expose, element);
    return () =>
      h(
        'fluent-switch',
        withListener(
          {
            ...controlAttrs(attrs, 'macvue-switch'),
            ref: element,
            checked: currentValue(),
            disabled: booleanAttribute(props.disabled),
            name: props.name,
            value: props.value,
            required: props.required,
            'data-control-size': props.size,
          },
          'onChange',
          change,
        ),
        slots.default?.(),
      );
  },
});

export const AppSlider = defineComponent({
  name: 'WindowsSlider',
  inheritAttrs: false,
  props: {
    modelValue: { default: undefined },
    defaultValue: { default: undefined },
    min: { default: 0 },
    max: { default: 100 },
    step: { default: 1 },
    orientation: { default: 'horizontal' },
    ticks: { default: undefined },
    snapToTicks: { type: Boolean, default: false },
    size: { default: 'regular' },
    disabled: { type: Boolean, default: false },
    name: { default: undefined },
  },
  emits: ['update:modelValue', 'valueCommit'],
  setup(props, { attrs, emit, expose, slots }) {
    const element = ref(null);
    const localValue = ref(props.defaultValue ?? props.min);
    const currentValue = () =>
      props.modelValue === undefined ? localValue.value : props.modelValue;
    const sync = () => {
      if (!element.value) return;
      element.value.min = props.min;
      element.value.max = props.max;
      element.value.step =
        props.snapToTicks && props.ticks > 1
          ? (props.max - props.min) / (props.ticks - 1)
          : props.step;
      element.value.orientation = props.orientation;
      element.value.disabled = props.disabled;
      element.value.value = currentValue();
      if (props.name !== undefined) element.value.name = props.name;
    };
    const change = (event) => {
      const value = Number(event.currentTarget?.value ?? event.target?.value);
      if (!Number.isNaN(value)) {
        localValue.value = value;
        emit('update:modelValue', value);
      }
    };
    onMounted(() => {
      void ensureFluent().then(sync);
    });
    watch(
      () => [
        props.modelValue,
        props.min,
        props.max,
        props.step,
        props.orientation,
        props.disabled,
        props.ticks,
        props.snapToTicks,
      ],
      sync,
    );
    exposeControl(expose, element);
    return () =>
      h(
        'fluent-slider',
        withListener(
          {
            ...controlAttrs(attrs, 'macvue-slider'),
            ref: element,
            value: currentValue(),
            min: props.min,
            max: props.max,
            step:
              props.snapToTicks && props.ticks > 1
                ? (props.max - props.min) / (props.ticks - 1)
                : props.step,
            orientation: props.orientation,
            disabled: booleanAttribute(props.disabled),
            size: props.size === 'small' || props.size === 'mini' ? 'small' : 'medium',
            'data-ticks': props.ticks,
          },
          'onChange',
          change,
        ),
        slots.default?.(),
      );
  },
});

function descriptorFor(object, property) {
  let current = object;
  while (current && current !== Object.prototype) {
    const descriptor = Object.getOwnPropertyDescriptor(current, property);
    if (descriptor) return descriptor;
    current = Object.getPrototypeOf(current);
  }
  return null;
}

export const AppPopUpButtonItem = defineComponent({
  name: 'WindowsPopUpButtonItem',
  inheritAttrs: false,
  props: {
    value: { default: undefined },
    disabled: { type: Boolean, default: false },
    textValue: { default: undefined },
  },
  setup(props, { attrs, slots, expose }) {
    const element = ref(null);
    onMounted(() => {
      void ensureFluent();
    });
    exposeControl(expose, element);
    return () =>
      h(
        'fluent-option',
        {
          ...controlAttrs(attrs, 'macvue-pop-up-button-item'),
          ref: element,
          value: props.value == null ? '' : String(props.value),
          disabled: booleanAttribute(props.disabled),
        },
        slots.default?.() ?? (props.textValue == null ? undefined : String(props.textValue)),
      );
  },
});

export const AppPopUpButton = defineComponent({
  name: 'WindowsPopUpButton',
  inheritAttrs: false,
  props: {
    modelValue: { default: undefined },
    defaultValue: { default: undefined },
    open: { default: undefined },
    defaultOpen: { default: undefined },
    size: { default: 'regular' },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { default: undefined },
    autocomplete: { default: undefined },
    by: { default: undefined },
    dir: { default: undefined },
    placeholder: { default: '' },
    teleportTo: { default: undefined },
  },
  emits: ['update:modelValue', 'update:open'],
  setup(props, { attrs, emit, slots, expose }) {
    const element = ref(null);
    const localOpen = ref(Boolean(props.defaultOpen ?? false));
    let lastOpen;
    let suppressOpenEvent = false;
    let restoreOpen;
    let childObserver;

    const currentOpen = () => (props.open === undefined ? localOpen.value : Boolean(props.open));
    const syncValue = () => {
      // Fluent inserts its control in a queued connected callback.
      // Wait for that light-DOM control before using the value setter.
      if (!element.value?.control || !element.value.listbox || props.modelValue === undefined)
        return;
      const value = props.modelValue == null ? '' : String(props.modelValue);
      if (element.value.value !== value) element.value.value = value;
    };
    const syncOpen = () => {
      if (!element.value || props.open === undefined) return;
      suppressOpenEvent = true;
      element.value.open = Boolean(props.open);
      suppressOpenEvent = false;
      lastOpen = Boolean(props.open);
      localOpen.value = Boolean(props.open);
    };
    const observeOpen = (value, emitChange = true) => {
      const next = Boolean(value);
      if (next === lastOpen) return;
      lastOpen = next;
      localOpen.value = next;
      if (emitChange && !suppressOpenEvent) emit('update:open', next);
    };
    const patchOpen = () => {
      const target = element.value;
      const descriptor = target && descriptorFor(target, 'open');
      if (!target || !descriptor?.get || !descriptor.set) return;
      const original = {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set: descriptor.set,
      };
      Object.defineProperty(target, 'open', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get() {
          return descriptor.get.call(this);
        },
        set(value) {
          const before = descriptor.get.call(this);
          descriptor.set.call(this, value);
          const after = descriptor.get.call(this);
          if (after !== before) observeOpen(after);
        },
      });
      restoreOpen = () => Object.defineProperty(target, 'open', original);
      lastOpen = Boolean(target.open);
      return target;
    };
    const syncAfterInteraction = () => {
      queueMicrotask(() => {
        if (element.value) observeOpen(element.value.open);
      });
    };
    const change = (event) => {
      const value = event.currentTarget?.value ?? event.target?.value;
      if (value !== undefined && value !== null) emit('update:modelValue', value);
      syncAfterInteraction();
    };
    const valueSlot = () =>
      slots.value?.({
        selectedLabel: element.value?.displayValue ?? props.modelValue,
        modelValue: props.modelValue,
      });
    const controlAria = () =>
      Object.fromEntries(
        Object.entries(attrs).filter(([name]) => name.startsWith('aria-') || name === 'title'),
      );

    onMounted(() => {
      void ensureFluent().then(async () => {
        await nextTick();
        patchOpen();
        syncValue();
        syncOpen();
        childObserver = new MutationObserver(syncValue);
        if (element.value) childObserver.observe(element.value, { childList: true, subtree: true });
        syncValue();
      });
    });
    onBeforeUnmount(() => {
      restoreOpen?.();
      childObserver?.disconnect();
    });
    watch(() => props.modelValue, syncValue);
    watch(() => props.open, syncOpen);
    expose({
      el: element,
      focus: () => {
        invokeFocus(element.value, 'focus');
        void ensureFluent().then(() => invokeFocus(element.value, 'focus'));
      },
      blur: () => invokeFocus(element.value, 'blur'),
    });

    return () => {
      const dropdownAttrs = withListener(
        withListener(
          withListener(
            {
              ...controlAttrs(attrs, 'macvue-pop-up-button'),
              ref: element,
              type: 'dropdown',
              size: segmentSize(props.size),
              disabled: booleanAttribute(props.disabled),
              required: props.required,
              name: props.name,
              autocomplete: props.autocomplete,
              dir: props.dir,
              placeholder: props.placeholder,
            },
            'onChange',
            change,
          ),
          'onClick',
          syncAfterInteraction,
        ),
        'onKeydown',
        syncAfterInteraction,
      );
      const optionNodes = slots.default?.() || [];
      // Fluent 3 dropdowns require a fluent-listbox child. The component
      // creates its own light-DOM control button during upgrade; supplying a
      // second slot="control" button makes the library remove the adapter's
      // button and leaves the selected value blank. The generated button uses
      // the selected fluent-option text and preserves the native ARIA wiring.
      return h('fluent-dropdown', dropdownAttrs, [h('fluent-listbox', {}, optionNodes)]);
    };
  },
});

export const AppSegment = defineComponent({
  name: 'WindowsSegment',
  inheritAttrs: false,
  props: {
    value: { default: undefined },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { attrs, slots, expose }) {
    const element = ref(null);
    onMounted(() => {
      void ensureFluent();
    });
    exposeControl(expose, element);
    return () =>
      h(
        'fluent-tab',
        {
          ...controlAttrs(attrs, 'macvue-segment'),
          ref: element,
          'data-segment-value': props.value == null ? '' : String(props.value),
          disabled: booleanAttribute(props.disabled),
        },
        slots.default?.(),
      );
  },
});

export const AppSegmentedControl = defineComponent({
  name: 'WindowsSegmentedControl',
  inheritAttrs: false,
  props: {
    modelValue: { default: undefined },
    defaultValue: { default: undefined },
    type: { default: 'single' },
    size: { default: 'regular' },
    disabled: { type: Boolean, default: false },
    name: { default: undefined },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit, slots, expose }) {
    const element = ref(null);
    let syncing = false;
    let clicking = false;
    const localValue = ref(props.defaultValue ?? (props.type === 'multiple' ? [] : ''));
    const currentValue = () =>
      props.modelValue === undefined ? localValue.value : props.modelValue;
    const selected = (value) =>
      props.type === 'multiple'
        ? Array.isArray(currentValue()) &&
          currentValue().some((entry) => String(entry) === String(value))
        : String(currentValue()) === String(value);
    const sync = () => {
      const root = element.value;
      if (!root) return;
      const tabs = Array.from(root.children).filter(
        (child) => child.tagName?.toLowerCase() === 'fluent-tab',
      );
      tabs.forEach((tab, index) => {
        const value = tab.dataset.segmentValue ?? tab.getAttribute('value') ?? String(index);
        tab.classList.add('macvue-segment');
        tab.dataset.state = selected(value) ? 'on' : 'off';
      });
      const active = tabs.find((tab) => tab.dataset.state === 'on' && !tab.disabled);
      if (active && root.activeid !== active.id) {
        syncing = true;
        try {
          root.activeid = active.id;
        } finally {
          syncing = false;
        }
      }
    };
    const change = (event) => {
      const root = element.value;
      const active = root?.activetab || event.detail;
      // Fluent also emits change during connection, setTabs and activeid
      // synchronization. Those events must never overwrite the Vue model.
      if (syncing) return;
      if (
        !root?.isConnected ||
        props.disabled ||
        (!clicking && document.activeElement !== active)
      ) {
        void nextTick(() => sync());
        return;
      }
      const value = active?.dataset?.segmentValue ?? active?.getAttribute?.('value');
      if (value === undefined) return;
      let next = value;
      if (props.type === 'multiple') {
        const values = Array.isArray(currentValue()) ? [...currentValue()] : [];
        const index = values.findIndex((entry) => String(entry) === String(value));
        if (index >= 0) values.splice(index, 1);
        else values.push(value);
        next = values;
      }
      localValue.value = next;
      emit('update:modelValue', next);
      void nextTick(() => sync());
    };
    onMounted(async () => {
      await ensureFluent();
      await nextTick();
      sync();
    });
    watch(() => [props.modelValue, props.disabled, props.type], sync);
    exposeControl(expose, element);
    return () =>
      h(
        'fluent-tablist',
        withListener(
          {
            ...controlAttrs(attrs, 'macvue-segmented'),
            ref: element,
            appearance: 'subtle',
            size: segmentSize(props.size),
            orientation: 'horizontal',
            disabled: booleanAttribute(props.disabled),
            'aria-disabled': props.disabled ? 'true' : undefined,
            name: props.name,
            onClickCapture: () => {
              clicking = true;
              queueMicrotask(() => {
                clicking = false;
              });
            },
          },
          'onChange',
          change,
        ),
        slots.default?.(),
      );
  },
});

function textInputType(kind) {
  if (kind === 'secure') return 'password';
  if (kind === 'search') return 'search';
  return 'text';
}

function textInputComponent(name, kind, extraClass, defaultPlaceholder) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      modelValue: { default: undefined },
      defaultValue: { default: undefined },
      size: { default: 'regular' },
      disabled: { type: Boolean, default: false },
      placeholder: { default: defaultPlaceholder },
      name: { default: undefined },
      required: { type: Boolean, default: false },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit, expose, slots }) {
      const element = ref(null);
      const input = ref(null);
      const localValue = ref(props.defaultValue ?? '');
      const currentValue = () =>
        props.modelValue === undefined ? localValue.value : String(props.modelValue ?? '');
      const resolveInput = () =>
        input.value ||
        element.value?.shadowRoot?.querySelector('input') ||
        element.value?.control ||
        null;
      const sync = () => {
        const target = element.value;
        if (!target) return;
        target.type = textInputType(kind);
        target.value = currentValue();
        target.disabled = props.disabled;
        target.placeholder = props.placeholder;
        if (props.name !== undefined) target.name = props.name;
        target.required = props.required;
        input.value = target.shadowRoot?.querySelector('input') || target.control || null;
      };
      const update = (event) => {
        const value = String(event.currentTarget?.value ?? event.target?.value ?? '');
        localValue.value = value;
        emit('update:modelValue', value);
      };
      onMounted(() => {
        void ensureFluent().then(sync);
      });
      watch(
        () => [props.modelValue, props.disabled, props.placeholder, props.name, props.required],
        sync,
      );
      expose({
        el: element,
        get input() {
          return resolveInput();
        },
        getInput: resolveInput,
        focus: () => {
          const target = resolveInput();
          if (target) target.focus();
          else
            void ensureFluent().then(() => {
              sync();
              resolveInput()?.focus();
            });
        },
        blur: () => (resolveInput() || element.value)?.blur?.(),
      });
      return () =>
        h(
          'fluent-text-input',
          withListener(
            {
              ...controlAttrs(attrs, 'macvue-field', extraClass),
              ref: element,
              type: textInputType(kind),
              value: currentValue(),
              disabled: booleanAttribute(props.disabled),
              placeholder: props.placeholder,
              name: props.name,
              required: props.required,
              'control-size':
                props.size === 'small' || props.size === 'mini'
                  ? 'small'
                  : props.size === 'large' || props.size === 'extra-large'
                    ? 'large'
                    : 'medium',
            },
            'onInput',
            update,
          ),
          slots.default?.(),
        );
    },
  });
}

export const AppSecureField = textInputComponent('WindowsSecureField', 'secure', '', undefined);
export const AppTextField = textInputComponent('WindowsTextField', 'text', '', undefined);
export const AppSearchField = textInputComponent(
  'WindowsSearchField',
  'search',
  'macvue-field--search',
  'Search',
);

export function disposeFluentTheme() {
  themeMediaQuery?.removeEventListener?.('change', themeApply);
  themeMediaQuery?.removeListener?.(themeApply);
  themeObserver?.disconnect();
  themeMediaQuery = null;
  themeObserver = null;
  themeApply = null;
  appliedThemeKey = null;
}
