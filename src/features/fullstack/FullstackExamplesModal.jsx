import React, { useMemo, useState } from "react";
import { X, LayoutGrid, Rocket } from "lucide-react";
import {
  FULLSTACK_TEMPLATE_CATEGORIES,
  FULLSTACK_TEMPLATES,
  filterTemplatesByCategory,
} from "../workspace/fullstackTemplateCatalog";

const categoryLabel = (id) =>
  FULLSTACK_TEMPLATE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

const TEMPLATE_THEMES = {
  "fullstack-workshop": { icon: "⚡", accent: "theme-terminal" },
  "pay-escrow": { icon: "🔒", accent: "theme-escrow" },
  "tip-jar": { icon: "🫙", accent: "theme-tipjar" },
  "donation-vault": { icon: "💚", accent: "theme-vault" },
  "invoice-split": { icon: "🧾", accent: "theme-receipt" },
  "savings-circle": { icon: "◉", accent: "theme-circle" },
};

const FullstackExamplesModal = ({ onClose, onCreate }) => {
  const [category, setCategory] = useState("all");

  const templates = useMemo(
    () => filterTemplatesByCategory(category),
    [category],
  );

  const handleCreate = (templateId) => {
    onClose();
    onCreate(templateId);
  };

  return (
    <div className="fs-examples-backdrop" onClick={onClose}>
      <div
        className="fs-examples-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fs-examples-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="fs-examples-header">
          <div>
            <h2 id="fs-examples-title" className="fs-examples-title">
              <LayoutGrid size={18} />
              Fullstack Examples
            </h2>
            <p className="fs-examples-subtitle">
              Soroban contract + Vite frontend — deploy, preview, and sign with Freighter.
            </p>
          </div>
          <button type="button" className="fs-examples-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <nav className="fs-examples-tabs" aria-label="Example categories">
          {FULLSTACK_TEMPLATE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`fs-examples-tab${category === cat.id ? " active" : ""}`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </nav>

        <div className="fs-examples-grid">
          {templates.map((tpl) => {
            const theme = TEMPLATE_THEMES[tpl.id] ?? { icon: "✦", accent: "" };
            return (
            <article key={tpl.id} className={`fs-example-card ${theme.accent}`}>
              <div className="fs-example-preview" aria-hidden>
                <span className="fs-example-icon">{theme.icon}</span>
              </div>
              <div className="fs-example-card-head">
                <h3 className="fs-example-name">{tpl.name}</h3>
                <span className="fs-example-category">{categoryLabel(tpl.category)}</span>
              </div>
              <p className="fs-example-tagline">{tpl.tagline}</p>
              <ul className="fs-example-features">
                {tpl.stellarFeatures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p className="fs-example-demo">
                <strong>Try it:</strong> {tpl.demoAction}
              </p>
              <button
                type="button"
                className="fs-example-create"
                onClick={() => handleCreate(tpl.id)}
              >
                <Rocket size={14} />
                Create project
              </button>
            </article>
            );
          })}
        </div>

        {templates.length === 0 && (
          <p className="fs-examples-empty">No examples in this category yet.</p>
        )}
      </div>
    </div>
  );
};

export default FullstackExamplesModal;
