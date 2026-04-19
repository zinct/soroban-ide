import React, { memo, useState, useMemo } from "react";
import { Copy, Check } from "lucide-react";
import { tutorialData } from "./tutorialData";
import { loadState, saveStateSection } from "../../utils/storage";

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      className={`tutorial-copy-btn ${copied ? "copied" : ""}`} 
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

const SECTIONS = [
  { id: "soroban", title: "Soroban", category: "Basics" },
  { id: "studio", title: "Soroban Studio", category: "Basics" },
  { id: "structure", title: "Project Structure", category: "Project" },
  { id: "contract", title: "Contract", category: "Smart Contract" },
  { id: "variable", title: "Variabel & Tipe Data", category: "Smart Contract" },
  { id: "struct", title: "Struct", category: "Smart Contract" },
  { id: "function", title: "Contract Function", category: "Smart Contract" },
  { id: "storage", title: "Storage", category: "Data" },
  { id: "wallet", title: "Wallet", category: "Network" },
  { id: "deploy", title: "Deploy to testnet", category: "Network" },
];

const TutorialPanel = memo(() => {
  const [selectedId, setSelectedId] = useState(null);
  const [lang, setLang] = useState(() => {
    const saved = loadState()?.tutorial?.lang;
    return saved || "en";
  });

  const handleSetLang = (newLang) => {
    setLang(newLang);
    saveStateSection("tutorial", { lang: newLang });
  };

  const selectedSection = useMemo(() => SECTIONS.find((s) => s.id === selectedId), [selectedId]);

  const formatText = (text) => {
    if (!text) return text;
    // Handle bold (**)
    const boldParts = text.split("**");
    return boldParts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i}>{part}</strong>;
      }
      // Handle italic (*)
      const italicParts = part.split("*");
      return italicParts.map((subPart, j) => {
        if (j % 2 === 1) {
          return <em key={j}>{subPart}</em>;
        }
        return subPart;
      });
    });
  };

  const renderSectionList = () => {
    // Group by category
    const categories = Array.from(new Set(SECTIONS.map((s) => s.category)));

    return (
      <div className="tutorial-list-container">
        <div className="sidebar-header">
          <div className="sidebar-title">Tutorial & Docs</div>
          <div className="tutorial-lang-selector">
            <button className={`lang-btn ${lang === "id" ? "active" : ""}`} onClick={() => handleSetLang("id")} title="Bahasa Indonesia">
              ID
            </button>
            <div className="lang-divider"></div>
            <button className={`lang-btn ${lang === "en" ? "active" : ""}`} onClick={() => handleSetLang("en")} title="English">
              EN
            </button>
          </div>
        </div>
        <div className="tutorial-scroll-area">
          {categories.map((cat) => (
            <div key={cat} className="tutorial-category-group">
              <div className="tutorial-category-title">{cat}</div>
              {SECTIONS.filter((s) => s.category === cat).map((section) => (
                <button key={section.id} className="tutorial-list-item" onClick={() => setSelectedId(section.id)}>
                  <span className="tutorial-item-title">{section.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const highlightCode = (code, lang = "rust") => {
    if (!code) return code;

    const rustTokens = [
      { class: "hl-comment", regex: /(\/\/.*)/g },
      { class: "hl-attr", regex: /(#\[.*?\]|#!\[.*?\])/g },
      { class: "hl-string", regex: /(".*?")/g },
      { class: "hl-keyword", regex: /\b(pub|fn|impl|struct|use|mod|let|mut|match|if|else|return|as|crate|self|Self|super|active|in|where|for|while|loop|dyn|enum|type|const|static)\b/g },
      { class: "hl-type", regex: /\b(u8|u16|u32|u64|u128|i8|i16|i32|i64|i128|f32|f64|str|String|bool|Env|Vec|Symbol|Option|Result|Note)\b/g },
      { class: "hl-bool", regex: /\b(true|false)\b/g },
      { class: "hl-macro", regex: /\b(\w+!)/g },
      { class: "hl-fn", regex: /\b([a-z_][a-z0-9_]*)(?=\s*\()/g },
    ];

    const shellTokens = [
      { class: "hl-comment", regex: /(#.*)/g },
      { class: "hl-command", regex: /\b(stellar|cargo|rustup|npm|npx|node|git|ls|cd|mkdir|rm|cp|mv)\b/g },
      { class: "hl-flag", regex: /((?:\s|^)--?\w+)/g },
      { class: "hl-string", regex: /(".*?"|'.*?')/g },
    ];

    const tokens = lang === "sh" || lang === "terminal" || lang === "bash" ? shellTokens : rustTokens;

    let highlighted = [{ text: code, isToken: false }];

    tokens.forEach((token) => {
      let newItems = [];
      highlighted.forEach((item) => {
        if (item.isToken) {
          newItems.push(item);
        } else {
          const parts = item.text.split(token.regex);
          parts.forEach((part, i) => {
            if (part === undefined || part === "") return;
            if (i % 2 === 1) {
              newItems.push({ text: part, isToken: true, className: token.class });
            } else {
              newItems.push({ text: part, isToken: false });
            }
          });
        }
      });
      highlighted = newItems;
    });

    return highlighted.map((item, i) =>
      item.isToken ? (
        <span key={i} className={item.className}>
          {item.text}
        </span>
      ) : (
        item.text
      ),
    );
  };

  const renderSectionDetail = () => {
    if (!selectedSection) return null;

    const content = tutorialData[lang]?.[selectedId];

    const CodeHeader = ({ label, copyText }) => (
      <div className="tutorial-code-header">
        <div className="code-header-left">
          <div className="editor-dots">
            <div className="editor-dot" style={{ backgroundColor: "#ff5f56", opacity: 1 }}></div>
            <div className="editor-dot" style={{ backgroundColor: "#ffbd2e", opacity: 1 }}></div>
            <div className="editor-dot" style={{ backgroundColor: "#27c93f", opacity: 1 }}></div>
          </div>
          <span>{label}</span>
        </div>
        {copyText && <CopyButton text={copyText} />}
      </div>
    );

    return (
      <div className="tutorial-detail-container">
        <div className="sidebar-header">
          <button className="btn-text tutorial-back-btn" onClick={() => setSelectedId(null)}>
            <span>← Back</span>
          </button>
          <div className="tutorial-lang-selector">
            <button className={`lang-btn ${lang === "id" ? "active" : ""}`} onClick={() => handleSetLang("id")}>
              ID
            </button>
            <div className="lang-divider"></div>
            <button className={`lang-btn ${lang === "en" ? "active" : ""}`} onClick={() => handleSetLang("en")}>
              EN
            </button>
          </div>
        </div>

        <div className="tutorial-content-area">
          <div className="tutorial-header">
            <h1 className="tutorial-title">{content?.title || selectedSection.title}</h1>
          </div>

          <div className="tutorial-body">
            {content ? (
              <>
                <p className="tutorial-text">{formatText(content.intro)}</p>

                {content.sections?.map((sec, idx) => (
                  <div key={idx} className="tutorial-section-block">
                    {sec.sub && <h3 className="tutorial-sub">{formatText(sec.sub)}</h3>}
                    {sec.text && <p className="tutorial-text">{formatText(sec.text)}</p>}
                    {sec.image && (
                      <div className="tutorial-image-container">
                        <img src={sec.image} alt={sec.sub || "Tutorial"} className="tutorial-img" />
                      </div>
                    )}
                    {sec.list && (
                      <ul className="tutorial-list">
                        {sec.list.map((item, lIdx) => (
                          <li key={lIdx}>{formatText(item)}</li>
                        ))}
                      </ul>
                    )}
                    {sec.code && (
                      <div className="tutorial-code-block">
                        <CodeHeader label={sec.codeLang || "rust"} copyText={sec.code} />
                        <pre>
                          <code>{highlightCode(sec.code, sec.codeLang)}</code>
                        </pre>
                      </div>
                    )}
                    {sec.links && (
                      <div className="tutorial-link-grid" style={{ marginTop: '12px' }}>
                        {sec.links.map((link, lIdx) => (
                          <a key={lIdx} href={link.url} target="_blank" rel="noopener noreferrer" className="tutorial-external-link">
                            <span>{link.label}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {content.note && (
                  <div className="tutorial-note">
                    <span>{formatText(content.note)}</span>
                  </div>
                )}

                {content.links && (
                  <div className="tutorial-references">
                    <h3 className="tutorial-sub">Official Resources</h3>
                    <div className="tutorial-link-grid">
                      {content.links.map((link, lIdx) => (
                        <a key={lIdx} href={link.url} target="_blank" rel="noopener noreferrer" className="tutorial-external-link">
                          <span>{link.label}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="tutorial-placeholder">
                <p className="tutorial-text">
                  This section covers <strong>{selectedSection.title}</strong>. Content for this section will be added soon. (Language: {lang.toUpperCase()})
                </p>

                <div className="tutorial-note">
                  <span>Documentation and tutorials are currently being updated.</span>
                </div>

                <h3 className="tutorial-sub">Getting Started</h3>
                <p className="tutorial-text">To begin working with {selectedSection.title}, follow the standard Soroban practices and use our built-in tools.</p>

                <h3 className="tutorial-sub">Code Example</h3>
                <div className="tutorial-code-block">
                  <CodeHeader 
                    label="rust" 
                    copyText={`// Example code for ${selectedSection.title}\npub fn example() {\n    // Your implementation here\n}`} 
                  />
                  <pre>
                    <code>{highlightCode(`// Example code for ${selectedSection.title}\npub fn example() {\n    // Your implementation here\n}`, "rust")}</code>
                  </pre>
                </div>

                <h3 className="tutorial-sub">Terminal Commands</h3>
                <div className="tutorial-terminal-block">
                  <CodeHeader label="terminal" copyText="soroban contract build" />
                  <pre>
                    <code>{highlightCode(`soroban contract build`, "terminal")}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return <div className="tutorial-panel">{selectedId ? renderSectionDetail() : renderSectionList()}</div>;
});

export default TutorialPanel;
