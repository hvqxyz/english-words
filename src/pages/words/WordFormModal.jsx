import { useEffect, useState } from 'react';
import { addWord, updateWord, PARTS_OF_SPEECH } from '../../common/storage.js';
import { Modal } from '../../components/Modal.jsx';
import { Button } from '../../components/buttons/Button.jsx';
import { TextInput } from '../../components/inputs/TextInput.jsx';
import { TextArea } from '../../components/inputs/TextArea.jsx';
import { Select } from '../../components/inputs/Select.jsx';
import { TagInput } from '../../components/inputs/TagInput.jsx';

const EMPTY_FORM = { word: '', translation: '', partOfSpeech: '', category: '', definition: '', example: '', tags: [] };

function formFromWord(word) {
  if (!word) return EMPTY_FORM;
  const { word: text, translation, partOfSpeech, category, definition, example, tags } = word;
  return {
    word: text, translation, partOfSpeech: partOfSpeech || '', category: category || '',
    definition: definition || '', example: example || '', tags: tags || [],
  };
}

/**
 * Add/edit modal for a single word — `word` is null in add mode, or an
 * existing entry (with its `_row`) in edit mode. Both modes share the same
 * form; only the save call differs.
 */
export function WordFormModal({ open, word, categories, allTags, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(formFromWord(word));
      setMessage({ text: '', type: '' });
    }
  }, [open, word]);

  function setField(key) {
    return (value) => setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedWord = form.word.trim();
    const trimmedTranslation = form.translation.trim();
    if (!trimmedWord || !trimmedTranslation) return;

    const entry = {
      word: trimmedWord,
      translation: trimmedTranslation,
      partOfSpeech: form.partOfSpeech,
      category: form.category,
      definition: form.definition.trim(),
      example: form.example.trim(),
      tags: form.tags,
    };

    setPending(true);
    try {
      if (word) {
        await updateWord(word, entry);
      } else {
        await addWord(entry);
      }
      await onSaved();
      onClose();
    } catch (err) {
      setMessage({ text: `Couldn't save to Google Sheets: ${err.message}`, type: 'error' });
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h3>{word ? 'Edit word' : 'Add a word'}</h3>
      <form className="entry-form" onSubmit={handleSubmit}>
        <div className="entry-grid">
          <div className="form-field">
            <label htmlFor="word-input">English word</label>
            <TextInput id="word-input" placeholder="e.g. reluctant" required
              value={form.word} onChange={setField('word')} />
          </div>
          <div className="form-field">
            <label htmlFor="translation-input">Polish translation</label>
            <TextInput id="translation-input" placeholder="e.g. niechętny" required
              value={form.translation} onChange={setField('translation')} />
          </div>
          <div className="form-field">
            <label htmlFor="part-of-speech-input">Part of speech</label>
            <Select
              id="part-of-speech-input"
              placeholder="Not set"
              options={PARTS_OF_SPEECH.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))}
              value={form.partOfSpeech}
              onChange={setField('partOfSpeech')}
            />
          </div>
          <div className="form-field">
            <label htmlFor="category-input">Category</label>
            <Select
              id="category-input"
              placeholder="No category"
              options={categories.map((c) => c.name)}
              value={form.category}
              onChange={setField('category')}
            />
          </div>
          <div className="form-field entry-grid-full">
            <label htmlFor="tags-input">Tags</label>
            <TagInput
              id="tags-input"
              placeholder="Type a tag and press Enter"
              value={form.tags}
              onChange={setField('tags')}
              suggestions={allTags}
            />
          </div>
          <div className="form-field entry-grid-full">
            <label htmlFor="definition-input">Definition (English)</label>
            <TextArea id="definition-input" placeholder="What the word means, in English"
              value={form.definition} onChange={setField('definition')} />
          </div>
          <div className="form-field entry-grid-full">
            <label htmlFor="example-input">Example sentence</label>
            <TextArea id="example-input" placeholder="Used in a sentence"
              value={form.example} onChange={setField('example')} />
          </div>
        </div>
        {message.text && <p className={`message ${message.type}`.trim()} role="status">{message.text}</p>}
        <div className="app-modal-actions">
          <Button type="submit" disabled={pending}>{word ? 'Save changes' : 'Add word'}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
