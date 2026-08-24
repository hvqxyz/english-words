import { useEffect, useRef } from 'react';
import './Modal.css';

/**
 * Generic <dialog>-based modal. Uses the native showModal()/close() so
 * Escape and ::backdrop styling work for free; also closes on a backdrop
 * click.
 */
export function Modal({ open, onClose, className = '', children, ...rest }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className={`app-modal ${className}`.trim()}
      ref={dialogRef}
      onCancel={onClose}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      {...rest}
    >
      {children}
    </dialog>
  );
}
