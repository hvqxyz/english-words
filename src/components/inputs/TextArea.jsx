import './TextArea.css';

/**
 * Multi-line counterpart to TextInput, styled to match its input family
 * (same background/border/radius). Controlled like a normal textarea
 * (`value`/`onChange`).
 */
export function TextArea({
  value,
  onChange,
  placeholder,
  id,
  rows = 2,
  maxLength,
  required,
  disabled,
  className,
}) {
  return (
    <textarea
      id={id}
      className={`textarea-input ${className || ''}`.trim()}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      required={required}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}
