import { useState } from 'react';
import { X } from 'lucide-react';
import './TagInput.css';

/**
 * Chip-style multi-tag input. Controlled via `value` (array of strings) /
 * `onChange` (receives the new array). Enter or "," commits the current
 * text as a tag; Backspace on an empty field removes the last chip.
 * `suggestions` (e.g. every tag already used elsewhere) drives an
 * autocomplete dropdown: focusing an empty field lists them as hints to pick
 * from, and typing narrows the list to matches.
 */
export function TagInput({ value = [], onChange, suggestions = [], placeholder, id }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  function commit(raw) {
    const tag = raw.trim();
    if (!tag) return;
    if (!value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      onChange([...value, tag]);
    }
    setText('');
  }

  function removeTag(tag) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(text);
    } else if (e.key === 'Backspace' && !text && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  const query = text.trim().toLowerCase();
  const available = suggestions.filter((s) => !value.some((t) => t.toLowerCase() === s.toLowerCase()));
  const matches = (query ? available.filter((s) => s.toLowerCase().includes(query)) : available).slice(0, 6);

  return (
    <div className="tag-input-wrap">
      <div className="tag-input-field">
        {value.map((tag) => (
          <span className="tag-pill tag-input-chip" key={tag}>
            {tag}
            <button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(tag)}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          className="tag-input-text"
          placeholder={value.length === 0 ? placeholder : ''}
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            if (text.trim()) commit(text);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="tag-input-suggestions">
          {matches.map((s) => (
            <li key={s} onMouseDown={(e) => { e.preventDefault(); commit(s); }}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
