import './Button.css';

/**
 * Generic application button.
 *
 * Variants:
 * - primary   : Filled accent button (default)
 * - secondary : Outlined accent button
 * - copy      : Subtle outlined accent button
 * - danger    : Outlined critical button
 *
 * Sizes:
 * - default
 * - small
 */
export function Button({
                         children,
                         variant = 'primary',
                         size = 'default',
                         type = 'button',
                         className = '',
                         ...rest
                       }) {
  const classes = [
    'app-button',
    `app-button-${variant}`,
    size === 'small',
    className,
  ]
      .filter(Boolean)
      .join(' ');

  return (
      <button
          type={type}
          className={classes}
          {...rest}
      >
        {children}
      </button>
  );
}
