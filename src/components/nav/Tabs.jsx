import {
  BookOpen,
  Brain,
  Tags,
  BarChart3,
} from "lucide-react";

import "./Tabs.css";

const TAB_ICONS = {
  words: BookOpen,
  practice: Brain,
  categories: Tags,
  stats: BarChart3,
};

export function Tabs({
                       value,
                       onChange,
                       tabs,
                       className = "",
                       style,
                     }) {
  return (
      <div
          className={`tabs ${className}`.trim()}
          style={style}
          role="tablist"
      >
        {tabs.map((tab) => {
          const {
            value: tabValue,
            label,
          } =
              typeof tab === "object"
                  ? tab
                  : { value: tab, label: tab };

          const Icon = TAB_ICONS[tabValue.toLowerCase()];

          return (
              <button
                  key={tabValue}
                  type="button"
                  className="tab-btn"
                  role="tab"
                  aria-selected={value === tabValue}
                  onClick={() => onChange(tabValue)}
              >
                {Icon && <Icon size={18} strokeWidth={2} />}
                <span>{label}</span>
              </button>
          );
        })}
      </div>
  );
}
