import './Checkbox.css';

/**
 * Generic labeled checkbox. Controlled like a normal input (`checked`/`onChange`).
 */
export function Checkbox({
  checked,
  onChange,
  label,
  id,
  disabled,
  className,
}) {
  return (
      <label className={`checkbox-field ${className || ''}`.trim()}>
        <input
            type="checkbox"
            id={id}
            disabled={disabled}
            checked={checked}
            onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="checkbox-field-ui">
        <svg viewBox="0 0 20 20" fill="none">
            <path
                d="M5 10.5L8.5 14L15 6.5"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
          {label}
      </span>

      </label>
  );
}
