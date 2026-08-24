import { useState } from 'react';
import { Search } from "lucide-react";
import './SearchInput.css';

const DEFAULT_MAX_RESULTS = 8;

/**
 * Generic search-as-you-type combobox, controlled like a normal text input
 * (`value`/`onChange`) plus an `onSelect(item)` fired when a suggestion is
 * picked — the caller decides what a "match" means via `getLabel`/`getSublabel`,
 * so this isn't tied to any one kind of data.
 *
 * Set `searchable={false}` to render as a plain styled text input with no
 * dropdown at all, for call sites that just want the same look/feel without
 * search behavior.
 */
export function SearchInput({
  items = [],
  getLabel = (item) => String(item),
  getSublabel,
  value,
  onChange,
  onSelect,
  searchable = true,
  placeholder,
  id,
  disabled,
  required,
  maxResults = DEFAULT_MAX_RESULTS,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  if (!searchable) {
    return (
        <div className="search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
              type="text"
              id={id}
              className={`search-input ${className || ''}`.trim()}
              placeholder={placeholder}
              disabled={disabled}
              required={required}
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
          />
        </div>
    );
  }

  const query = (value || '').trim().toLowerCase();
  const matches = query
    ? items.filter((item) => getLabel(item).toLowerCase().includes(query)).slice(0, maxResults)
    : [];

  function selectItem(item) {
    onChange?.(getLabel(item));
    onSelect?.(item);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectItem(matches[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={`search-input-wrap ${className || ''}`.trim()}>
      <Search size={18} className="search-icon" />
      <input
        type="text"
        id={id}
        className="search-input"
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        required={required}
        value={value}
        onChange={(e) => {
          onChange?.(e.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => {
          if (value) setOpen(true);
        }}
        // Delay so a mousedown on a result can run first (mousedown fires before blur).
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onKeyDown={handleKeyDown}
      />
      {open && query && (
        <ul className="search-input-results">
          {matches.length === 0 ? (
            <li className="search-input-empty">No matches</li>
          ) : (
            matches.map((item, index) => (
              <li
                key={index}
                className={`search-input-result${index === activeIndex ? ' active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectItem(item);
                }}
              >
                <span className="search-input-result-label">{getLabel(item)}</span>
                {getSublabel && <span className="search-input-result-sublabel">{getSublabel(item)}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
