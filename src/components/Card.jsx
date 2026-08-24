import './Card.css';

/**
 * Generic card wrapper — own class names/CSS (not the shared .card).
 *
 * `headerAction` is optional content (e.g. a collapse/expand toggle button)
 * rendered to the right of the title.
 */
export function Card({ title, headerAction, className = '', children, ...rest }) {
  return (
    <section className={`app-card ${className}`.trim()} {...rest}>
      {(title || headerAction) && (
        <div className="app-card-header">
          {title && <h2 className="app-card-title">{title}</h2>}
          {headerAction}
        </div>
      )}
      {children}
    </section>
  );
}
