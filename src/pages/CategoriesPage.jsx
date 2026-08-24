import { useCallback, useEffect, useState } from 'react';
import { getCategories, addCategory, deleteCategory, getWords } from '../common/storage.js';
import { Card } from '../components/Card.jsx';
import { Button } from '../components/buttons/Button.jsx';
import { SearchInput } from '../components/inputs/SearchInput.jsx';
import { EntryList } from '../components/lists/EntryList.jsx';

export function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [words, setWords] = useState([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  const refresh = useCallback(async () => {
    try {
      const [c, w] = await Promise.all([getCategories(), getWords()]);
      setCategories(c);
      setWords(w);
      setMessage({ text: '', type: '' });
    } catch (err) {
      setMessage({ text: `Couldn't reach Google Sheets: ${err.message}`, type: 'error' });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function wordCount(categoryName) {
    return words.filter((w) => w.category === categoryName).length;
  }

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const duplicate = categories.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setMessage({ text: `"${duplicate.name}" is already in the list.`, type: 'error' });
      return;
    }
    try {
      await addCategory(trimmed);
      setName('');
      await refresh();
      setMessage({ text: 'Category added.', type: 'success' });
    } catch (err) {
      setMessage({ text: `Couldn't save to Google Sheets: ${err.message}`, type: 'error' });
    }
  }

  async function handleDelete(category) {
    const count = wordCount(category.name);
    const warning = count > 0
      ? ` ${count} word${count === 1 ? '' : 's'} using it will keep the label but it won't show in the category filter anymore.`
      : '';
    if (!window.confirm(`Remove "${category.name}"?${warning}`)) return;
    try {
      await deleteCategory(category._row);
      await refresh();
    } catch (err) {
      setMessage({ text: `Couldn't save to Google Sheets: ${err.message}`, type: 'error' });
    }
  }

  return (
    <Card title="Categories">
      <p className="label">Group your words (e.g. Travel, Business, Idioms) to filter and browse them faster.</p>
      <form className="inline-form" onSubmit={handleAdd}>
        <SearchInput
          searchable={false}
          placeholder="New category name"
          required
          value={name}
          onChange={setName}
        />
        <Button type="submit">Add category</Button>
      </form>
      {message.text && <p className={`message ${message.type}`.trim()} role="status">{message.text}</p>}

      {categories.length === 0 ? (
        <p className="message" role="status">No categories yet.</p>
      ) : (
        <EntryList
          itemLabel="category"
          items={categories.map((c) => ({
            key: c.name,
            label: c.name,
            value: `${wordCount(c.name)} word${wordCount(c.name) === 1 ? '' : 's'}`,
            removeLabel: `Remove ${c.name}`,
            onRemove: () => handleDelete(c),
          }))}
        />
      )}
    </Card>
  );
}
