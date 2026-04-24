import React, { memo, useState, useMemo, useRef, useEffect } from "react";
import { Copy, Check, CaretRight } from "@phosphor-icons/react";
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
    <button className={`tutorial-copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy} title="Copy to clipboard">
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

const LANGUAGES = [
  { id: "en", label: "English", flag: "🇺🇸" },
  { id: "ph", label: "Filipino", flag: "🇵🇭" },
  { id: "vn", label: "Tiếng Việt", flag: "🇻🇳" },
  { id: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
];

const UI = {
  en: {
    title: "Tutorial & Docs",
    back: "Back",
    resources: "Official Resources",
    categories: {
      basics: "Basics",
      project: "Project",
      contract: "Smart Contract",
      data: "Data",
      network: "Network",
    },
    sections: {
      soroban: "Get to know Soroban",
      studio: "Soroban Studio",
      structure: "Project Structure",
      contract: "Contract Anatomy",
      variable: "Variables & Types",
      struct: "Using Structs",
      function: "Contract Functions",
      storage: "Data Storage",
      wallet: "Identity & Wallet",
      deploy: "Deploy to Testnet",
    },
  },
  id: {
    title: "Panduan & Dokumen",
    back: "Kembali",
    resources: "Sumber Resmi",
    categories: {
      basics: "Dasar",
      project: "Proyek",
      contract: "Smart Contract",
      data: "Data",
      network: "Jaringan",
    },
    sections: {
      soroban: "Mengenal Soroban",
      studio: "Soroban Studio",
      structure: "Struktur Proyek",
      contract: "Anatomi Kontrak",
      variable: "Variabel & Tipe",
      struct: "Menggunakan Struct",
      function: "Fungsi Kontrak",
      storage: "Penyimpanan Data",
      wallet: "Identitas & Wallet",
      deploy: "Deploy ke Testnet",
    },
  },
  vn: {
    title: "Hướng dẫn & Tài liệu",
    back: "Quay lại",
    resources: "Tài nguyên chính thức",
    categories: {
      basics: "Cơ bản",
      project: "Dự án",
      contract: "Hợp đồng",
      data: "Dữ liệu",
      network: "Mạng lưới",
    },
    sections: {
      soroban: "Tìm hiểu về Soroban",
      studio: "Soroban Studio",
      structure: "Cấu trúc dự án",
      contract: "Cấu tạo hợp đồng",
      variable: "Biến & Kiểu dữ liệu",
      struct: "Sử dụng Struct",
      function: "Hàm trong hợp đồng",
      storage: "Lưu trữ dữ liệu",
      wallet: "Danh tính & Ví",
      deploy: "Triển khai Testnet",
    },
  },
  ph: {
    title: "Gabay at Dokumento",
    back: "Bumalik",
    resources: "Opisyal na Resources",
    categories: {
      basics: "Batayan",
      project: "Proyekto",
      contract: "Smart Contract",
      data: "Impormasyon",
      network: "Network",
    },
    sections: {
      soroban: "Alamin ang Soroban",
      studio: "Soroban Studio",
      structure: "Istraktura ng Proyekto",
      contract: "Anatomiya ng Kontrak",
      variable: "Variables & Types",
      struct: "Paggamit ng Struct",
      function: "Contract Functions",
      storage: "Data Storage",
      wallet: "Identidad & Wallet",
      deploy: "I-deploy sa Testnet",
    },
  },
};

const LangSelector = ({ currentLang, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const selected = LANGUAGES.find((l) => l.id === currentLang) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="tutorial-lang-dropdown-container" ref={containerRef}>
      <button className={`tutorial-lang-dropdown-trigger ${isOpen ? "open" : ""}`} onClick={() => setIsOpen(!isOpen)}>
        <span className="lang-flag-main">{selected.flag}</span>
        <span className="lang-id-label">{selected.id.toUpperCase()}</span>
        <CaretRight size={14} className={`dropdown-arrow ${isOpen ? "open" : ""}`} />
      </button>
      {isOpen && (
        <div className="tutorial-lang-dropdown-menu">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              className={`lang-option ${l.id === currentLang ? "active" : ""}`}
              onClick={() => {
                onSelect(l.id);
                setIsOpen(false);
              }}>
              <span className="lang-flag-opt">{l.flag}</span>
              <span className="lang-opt-label">{l.label}</span>
              {l.id === currentLang && <Check size={14} className="lang-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SECTIONS = [
  { id: "soroban", title: "Soroban", category: "basics" },
  { id: "studio", title: "Soroban Studio", category: "basics" },
  { id: "structure", title: "Project Structure", category: "project" },
  { id: "contract", title: "Contract", category: "contract" },
  { id: "variable", title: "Variabel & Tipe Data", category: "contract" },
  { id: "struct", title: "Struct", category: "contract" },
  { id: "function", title: "Contract Function", category: "contract" },
  { id: "errors", title: "Error Handling", category: "contract" },
  { id: "auth", title: "Authorization", category: "contract" },
  { id: "events", title: "Events & Logs", category: "contract" },
  { id: "crosscontract", title: "Cross-Contract Calls", category: "contract" },
  { id: "storage", title: "Storage", category: "data" },
  { id: "increment", title: "Counter Example (Storage + TTL)", category: "data" },
  { id: "wallet", title: "Wallet", category: "network" },
  { id: "deploy", title: "Deploy to testnet", category: "network" },
];

const TutorialPanel = memo(() => {
  const [selectedId, setSelectedId] = useState(() => {
    return loadState()?.tutorial?.selectedId || null;
  });
  const [lang, setLang] = useState(() => {
    const saved = loadState()?.tutorial?.lang;
    return saved || "en";
  });

  const handleSetLang = (newLang) => {
    setLang(newLang);
    const current = loadState()?.tutorial || {};
    saveStateSection("tutorial", { ...current, lang: newLang });
  };

  const handleSetSelectedId = (id) => {
    setSelectedId(id);
    const current = loadState()?.tutorial || {};
    saveStateSection("tutorial", { ...current, selectedId: id });
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
          <div className="sidebar-title">{UI[lang]?.title || "Tutorial & Docs"}</div>
          <LangSelector currentLang={lang} onSelect={handleSetLang} />
        </div>
        <div className="tutorial-scroll-area">
          {categories.map((cat) => (
            <div key={cat} className="tutorial-category-group">
              <div className="tutorial-category-title">{UI[lang]?.categories?.[cat] || cat}</div>
              {SECTIONS.filter((s) => s.category === cat).map((section) => {
                const sidebarTitle = UI[lang]?.sections?.[section.id] || section.title;
                return (
                  <button key={section.id} className="tutorial-list-item" onClick={() => handleSetSelectedId(section.id)}>
                    <span className="tutorial-item-title">{sidebarTitle}</span>
                  </button>
                );
              })}
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

    // Fall back to EN content when a translation hasn't been written yet,
    // so users never see a "coming soon" placeholder for a section that
    // exists in at least one language.
    const content = tutorialData[lang]?.[selectedId] || tutorialData.en?.[selectedId];

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
          <button className="btn-text tutorial-back-btn" onClick={() => handleSetSelectedId(null)}>
            <span>← {UI[lang]?.back || "Back"}</span>
          </button>
          <LangSelector currentLang={lang} onSelect={handleSetLang} />
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
                      <div className="tutorial-link-grid" style={{ marginTop: "12px" }}>
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
                    <h3 className="tutorial-sub">{UI[lang]?.resources || "Official Resources"}</h3>
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
                  <CodeHeader label="rust" copyText={`// Example code for ${selectedSection.title}\npub fn example() {\n    // Your implementation here\n}`} />
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
