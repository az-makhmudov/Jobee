import {
  forwardRef,
  useId,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Primitives.module.css';
import { iconAssets, type IconName } from './icons.js';

export function Icon({
  name,
  label,
  size = 24,
}: {
  name: IconName;
  label?: string;
  size?: number;
}) {
  return (
    <span
      className={styles.icon}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ '--icon': `url("${iconAssets[name]}")`, width: size, height: size } as CSSProperties}
    />
  );
}
export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${styles.button} btn ${className}`} {...props} />;
}
export function Card({
  className = '',
  onClick,
  onKeyDown,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`${styles.card} card ${className}`}
      onClick={onClick}
      role={props.role || (onClick ? 'button' : undefined)}
      tabIndex={props.tabIndex ?? (onClick ? 0 : undefined)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          onClick &&
          event.target === event.currentTarget &&
          !event.defaultPrevented &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault();
          event.currentTarget.click();
        }
      }}
    />
  );
}
function useFieldLabel(id: string) {
  const ref = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const parent = node.closest('.form-group') || node.parentElement;
    if (node.closest('label')) return;
    const labels = parent?.querySelectorAll('label');
    const controls = parent?.querySelectorAll('input,select,textarea');
    if (labels?.length === 1 && controls?.length === 1 && !labels[0].htmlFor)
      labels[0].htmlFor = id;
  }, [id]);
  return ref;
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, forwarded) {
    const generated = useId(),
      id = props.id || generated,
      ref = useFieldLabel(id);
    return (
      <input
        {...props}
        id={id}
        className={`${styles.field} ${props.className || ''}`}
        ref={(node) => {
          ref.current = node;
          if (typeof forwarded === 'function') forwarded(node);
          else if (forwarded) forwarded.current = node;
        }}
      />
    );
  },
);
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select(props, forwarded) {
    const generated = useId(),
      id = props.id || generated,
      ref = useFieldLabel(id);
    return (
      <select
        {...props}
        id={id}
        className={`${styles.field} ${props.className || ''}`}
        ref={(node) => {
          ref.current = node;
          if (typeof forwarded === 'function') forwarded(node);
          else if (forwarded) forwarded.current = node;
        }}
      />
    );
  },
);
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea(props, forwarded) {
  const generated = useId(),
    id = props.id || generated,
    ref = useFieldLabel(id);
  return (
    <textarea
      {...props}
      id={id}
      className={`${styles.field} ${props.className || ''}`}
      ref={(node) => {
        ref.current = node;
        if (typeof forwarded === 'function') forwarded(node);
        else if (forwarded) forwarded.current = node;
      }}
    />
  );
});
export function Tabs({
  label,
  value,
  items,
  onChange,
  panelId,
}: {
  label: string;
  panelId?: string;
  value: string;
  items: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          ref={(n) => {
            refs.current[index] = n;
          }}
          key={item.id}
          type="button"
          className={styles.tab}
          role="tab"
          aria-controls={panelId}
          aria-selected={value === item.id}
          tabIndex={value === item.id ? 0 : -1}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            let next = index;
            if (event.key === 'ArrowRight') next = (index + 1) % items.length;
            else if (event.key === 'ArrowLeft') next = (index + items.length - 1) % items.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = items.length - 1;
            else return;
            event.preventDefault();
            refs.current[next]?.focus();
            onChange(items[next].id);
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
const modalStack: HTMLElement[] = [];
let rootWasInert = false;
let bodyOverflow = '';
export function ModalSurface({
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null),
    titleId = useId();
  useLayoutEffect(() => {
    const surface = ref.current;
    if (!surface) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    if (!modalStack.length) {
      rootWasInert = root?.inert ?? false;
      bodyOverflow = document.body.style.overflow;
    }
    const lower = modalStack.at(-1);
    if (lower) lower.inert = true;
    const content = surface.firstElementChild as HTMLElement | null;
    if (content) {
      content.setAttribute('role', 'dialog');
      content.setAttribute('aria-modal', 'true');
      content.tabIndex = -1;
      const title = content.querySelector('h1,h2,h3,.modal-title');
      if (title) {
        if (!title.id) title.id = titleId;
        content.setAttribute('aria-labelledby', title.id);
      } else content.setAttribute('aria-label', 'Dialog');
    }
    modalStack.push(surface);
    if (root) root.inert = true;
    const focusable = () =>
      Array.from(
        surface.querySelectorAll<HTMLElement>(
          'button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((n) => !n.hasAttribute('disabled') && n.getClientRects().length > 0);
    (focusable()[0] || content)?.focus();
    const key = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== surface) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        const close = Array.from(surface.querySelectorAll<HTMLButtonElement>('button')).find(
          (b) =>
            !b.disabled &&
            /^(close|cancel|×|✕|close dialog|close notifications)$/i.test(
              (b.getAttribute('aria-label') || b.textContent || '').trim(),
            ),
        );
        if (close) close.click();
        else surface.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      if (event.key === 'Tab') {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes.at(-1);
        if (!first) {
          event.preventDefault();
          content?.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first || !surface.contains(document.activeElement))
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !surface.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      const i = modalStack.indexOf(surface);
      if (i >= 0) modalStack.splice(i, 1);
      const top = modalStack.at(-1);
      if (top) top.inert = false;
      else {
        if (root) root.inert = rootWasInert;
        document.body.style.overflow = bodyOverflow;
      }
      if (previous?.isConnected && (!top || top.contains(previous))) previous.focus();
      else (top?.querySelector('button') as HTMLElement | null)?.focus();
    };
  }, [titleId]);
  return createPortal(
    <div {...props} ref={ref}>
      {children}
    </div>,
    document.body,
  );
}
