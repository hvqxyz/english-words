import './Select.css';

/**
 * Generic select, styled to match TextInput/SearchInput's input look (same
 * height/background/border/radius) so they read as one input family wherever
 * they sit together. Controlled like a normal select (`value`/`onChange`).
 *
 * `options` entries are either a plain value (used as both value and label)
 * or `{ value, label }`. `placeholder` renders as a disabled-looking empty
 * option when no value is selected yet.
 */
export function Select({
  value,
  onChange,
  options = [],
  placeholder,
  id,
  required,
  disabled,
  className,
}) {
  return (
    <select
      id={id}
      className={`select-input ${className || ''}`.trim()}
      required={required}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => {
        const { value: optValue, label } = typeof option === 'object' ? option : { value: option, label: option };
        return (
          <option key={optValue} value={optValue}>{label}</option>
        );
      })}
    </select>
  );
}
