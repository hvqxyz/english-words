import './TextInput.css';

/**
 * Generic text input, styled to match Select/SearchInput's input look
 * (same height/background/border/radius) so they read as one input family
 * wherever they sit together. Controlled like a normal input (`value`/`onChange`).
 */
export function TextInput({
  value,
  onChange,
  placeholder,
  id,
  maxLength,
  required,
  disabled,
  autoFocus,
  className,
}) {
  return (
    <input
      type="text"
      id={id}
      className={`text-input ${className || ''}`.trim()}
      placeholder={placeholder}
      maxLength={maxLength}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}
