import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { pushBack } from '../core/backStack';

/*
 * One bottom sheet for habits and tasks (both apps had their own).
 * Slides up, closes on scrim tap, Escape, the Android back button (via the back stack) or a swipe down
 * on the handle, and animates out before calling onClose.
 */

const CloseCtx = createContext<() => void>(() => {});
/** Animate the surrounding sheet closed (use from buttons inside a sheet). */
export const useCloseSheet = () => useContext(CloseCtx);

interface Props {
  onClose: () => void;
  label: string;
  /** Header title (tasks style). Habit sheets draw their own header inside children. */
  title?: ReactNode;
  footer?: ReactNode;
  /** 'tall' is for big editors. */
  size?: 'auto' | 'tall';
  children: ReactNode | ((close: () => void) => ReactNode);
}

export function Sheet({ onClose, label, title, footer, size = 'auto', children }: Props) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const [dragY, setDragY] = useState(0);
  const start = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => onCloseRef.current(), 200);
  }, []);

  useEffect(() => pushBack(close), [close]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('sheet-open');
    };
  }, [close]);

  const onTouchStart = (e: React.TouchEvent) => (start.current = e.touches[0].clientY);
  const onTouchMove = (e: React.TouchEvent) => {
    if (start.current != null) setDragY(Math.max(0, e.touches[0].clientY - start.current));
  };
  const onTouchEnd = () => {
    if (dragY > 90) close();
    else setDragY(0);
    start.current = null;
  };

  return createPortal(
    <div className={`sheet-root${closing ? ' closing' : ''}`}>
      <div className="sheet-scrim" onClick={close} />
      <div
        className={`sheet sheet--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div className="sheet-grab" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="sheet-grabber" />
          {title && <h2 className="sheet-title">{title}</h2>}
        </div>
        <CloseCtx.Provider value={close}>
          {typeof children === 'function' ? (
            children(close)
          ) : (
            <>
              <div className="sheet-body">{children}</div>
              {footer && <div className="sheet-foot">{footer}</div>}
            </>
          )}
        </CloseCtx.Provider>
      </div>
    </div>,
    document.body,
  );
}
