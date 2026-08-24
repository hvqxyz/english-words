import { Fragment, useState } from "react";
import { Trash2, Pencil, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "../buttons/Button.jsx";
import "./EntryList.css";

const DEFAULT_VISIBLE_ITEMS = 3;

/**
 * Generic expandable list with per-row edit/delete actions, used for the
 * words list, categories list, and any other "name + value, optionally with
 * expandable details" list in the app.
 *
 * items: [{ key, label, value, details, extraActions, onEdit, editLabel, onRemove, removeLabel }, ...]
 * extraActions (optional): [{ icon: Component, label, onClick }, ...] — extra
 * icon buttons rendered before edit/remove, for row actions specific to one
 * page (e.g. WordsPage's "pronounce this word").
 * itemLabel: plural noun shown in the "Show N more ___" toggle (default "item").
 * expandable: set false to always render every item with no "Show N more"/
 * "Show less" toggle — for callers (e.g. WordsPage) that already cap how
 * many items they pass in, so a second round of hiding is just confusing.
 */
export function EntryList({ items, itemLabel = "item", expandable = true }) {
    const [expanded, setExpanded] = useState(false);
    const [openKeys, setOpenKeys] = useState(new Set());

    const visibleItems = !expandable || expanded
        ? items
        : items.slice(0, DEFAULT_VISIBLE_ITEMS);

    const hiddenCount = expandable ? items.length - DEFAULT_VISIBLE_ITEMS : 0;

    function toggleOpen(key) {
        setOpenKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    return (
        <div className="entry-list-container">
            <div className="entry-list-card">
                <ul className="entry-list">
                    {visibleItems.map(
                        ({ key, label, value, extraActions, onEdit, editLabel, onRemove, removeLabel, details }) => {
                            const hasDetails = Boolean(details);
                            const isOpen = hasDetails && openKeys.has(key);
                            return (
                                <Fragment key={key}>
                                    <li
                                        className={`entry-list-row${hasDetails ? " entry-list-row-clickable" : ""}${isOpen ? " expanded" : ""}`}
                                        onClick={hasDetails ? () => toggleOpen(key) : undefined}
                                        role={hasDetails ? "button" : undefined}
                                        tabIndex={hasDetails ? 0 : undefined}
                                        aria-expanded={hasDetails ? isOpen : undefined}
                                        onKeyDown={hasDetails ? (e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                toggleOpen(key);
                                            }
                                        } : undefined}
                                    >
                                        <div className="entry-list-main">
                      <span className="entry-list-name" title={label}>
                        {label}
                      </span>
                                        </div>

                                        <div className="entry-list-actions">
                      <span className="entry-list-value">
                        {value}
                      </span>

                                            {hasDetails && (
                                                <ChevronDown
                                                    size={16}
                                                    className={`entry-list-chevron${isOpen ? " open" : ""}`}
                                                />
                                            )}

                                            {extraActions && extraActions.map(({ icon: Icon, label: actionLabel, onClick }, i) => (
                                                <Button
                                                    key={i}
                                                    className="entry-list-remove"
                                                    aria-label={actionLabel}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onClick();
                                                    }}
                                                >
                                                    <Icon size={16} />
                                                </Button>
                                            ))}

                                            {onEdit && (
                                                <Button
                                                    className="entry-list-remove"
                                                    aria-label={editLabel}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEdit();
                                                    }}
                                                >
                                                    <Pencil size={16} />
                                                </Button>
                                            )}

                                            {onRemove && (
                                                <Button
                                                    className="entry-list-remove"
                                                    aria-label={removeLabel}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRemove();
                                                    }}
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            )}
                                        </div>
                                    </li>
                                    {hasDetails && (
                                        <li className={`entry-list-details-outer${isOpen ? " open" : ""}`}>
                                            <div className="entry-list-details-inner">
                                                <div className="entry-list-details-row">{details}</div>
                                            </div>
                                        </li>
                                    )}
                                </Fragment>
                            );
                        }
                    )}
                </ul>
            </div>

            {hiddenCount > 0 && (
                <button
                    type="button"
                    className="entry-list-toggle"
                    onClick={() => setExpanded((e) => !e)}
                >
                    {expanded ? (
                        <>
                            <ChevronUp size={16} />
                            Show less
                        </>
                    ) : (
                        <>
                            <ChevronDown size={16} />
                            Show {hiddenCount} more {itemLabel}
                            {hiddenCount > 1 ? "s" : ""}
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
