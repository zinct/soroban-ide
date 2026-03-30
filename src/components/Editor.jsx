import React, { useEffect, useRef, useMemo, useState } from "react";
import * as monaco from "monaco-editor";

// Helper to detect file type from extension
const getFileType = (filePath) => {
  if (!filePath) return "code";
  const ext = filePath.split(".").pop()?.toLowerCase();

  const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico"];
  if (imageExts.includes(ext)) return "image";

  if (ext === "pdf") return "pdf";

  return "code";
};

// Image Viewer Component
const ImageViewer = ({ filePath, content }) => {
  const dataUrl = useMemo(() => {
    if (!content) return null;
    // If content is already data URL, return it
    if (content.startsWith("data:")) return content;

    // Detect MIME type from extension
    const ext = filePath?.split(".").pop()?.toLowerCase() || "png";
    const mimeType = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;

    // Content should be base64 string from Layout.jsx
    return `data:${mimeType};base64,${content}`;
  }, [filePath, content]);

  if (!dataUrl) {
    return (
      <div className="binary-viewer">
        <div className="binary-message">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <p>Cannot display image</p>
        </div>
      </div>
    );
  }

  return (
    <div className="image-viewer">
      <img src={dataUrl} alt={filePath} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
    </div>
  );
};

// PDF Viewer Component - using iframe with data URL
const PDFViewer = ({ filePath, content }) => {
  const dataUrl = useMemo(() => {
    if (!content) return null;
    if (content.startsWith("data:")) return content;
    return `data:application/pdf;base64,${content}`;
  }, [content]);

  if (!dataUrl) {
    return (
      <div className="binary-viewer">
        <div className="binary-message">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          <p>Cannot display PDF</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <iframe src={dataUrl} title="PDF Viewer" width="100%" height="100%" style={{ border: "none" }} type="application/pdf" />
    </div>
  );
};

// Configure Monaco Editor with custom theme and language support
const configureMonaco = () => {
  // Define Community Material Theme - Darker (less blue, more dark)
  monaco.editor.defineTheme("community-material", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "e0e0e0", background: "1a1a1a" },
      { token: "keyword", foreground: "C792EA", fontStyle: "bold" },
      { token: "keyword.control", foreground: "C792EA" },
      { token: "keyword.operator", foreground: "89DDFF" },
      { token: "string", foreground: "C3E88D" },
      { token: "string.escape", foreground: "F78C6C" },
      { token: "comment", foreground: "616161" },
      { token: "comment.doc", foreground: "616161" },
      { token: "number", foreground: "F78C6C" },
      { token: "number.hex", foreground: "F78C6C" },
      { token: "regexp", foreground: "C3E88D" },
      { token: "type", foreground: "82AAFF" },
      { token: "interface", foreground: "82AAFF" },
      { token: "class", foreground: "FFCB6B", fontStyle: "bold" },
      { token: "function", foreground: "82AAFF" },
      { token: "macro", foreground: "82AAFF" },
      { token: "variable", foreground: "FF5370" },
      { token: "variable.predefined", foreground: "FF5370" },
      { token: "parameter", foreground: "e0e0e0" },
      { token: "property", foreground: "FF5370" },
      { token: "tag", foreground: "FF5370" },
      { token: "attribute.name", foreground: "FFCB6B" },
      { token: "attribute.value", foreground: "C3E88D" },
      { token: "operator", foreground: "89DDFF" },
      { token: "delimiter", foreground: "89DDFF" },
      { token: "delimiter.bracket", foreground: "89DDFF" },
      { token: "error", foreground: "ff5252" },
      { token: "warning", foreground: "ffd740" },
      { token: "info", foreground: "82AAFF" },
      { token: "namespace", foreground: "B2CCD6" },
      { token: "enumMember", foreground: "FFCB6B" },
      { token: "constant", foreground: "F78C6C" },
    ],
    colors: {
      "editor.background": "#1a1a1a",
      "editor.foreground": "#e0e0e0",
      "editorLineNumber.foreground": "#424242",
      "editorLineNumber.activeForeground": "#e0e0e0",
      "editor.selectionBackground": "#3d3d3d",
      "editor.inactiveSelectionBackground": "#2a2a2a",
      "editor.lineHighlightBackground": "#212121",
      "editor.lineHighlightBorder": "#2d2d2d",
      "editor.findMatchBackground": "#F78C6C66",
      "editor.findMatchHighlightBackground": "#C792EA66",
      "editor.findRangeHighlightBackground": "#3d3d3d",
      "editor.hoverHighlightBackground": "#3d3d3d",
      "editor.wordHighlightBackground": "#C792EA44",
      "editor.wordHighlightStrongBackground": "#C792EA66",
      "editorBracketMatch.background": "#2a2a2a",
      "editorBracketMatch.border": "#89DDFF",
      "editorError.foreground": "#ff5252",
      "editorWarning.foreground": "#ffd740",
      "editorInfo.foreground": "#82AAFF",
      "editorHint.foreground": "#ffffff",
      "editorGutter.background": "#1a1a1a",
      "editorGutter.modifiedBackground": "#82AAFF",
      "editorGutter.addedBackground": "#C3E88D",
      "editorGutter.deletedBackground": "#FF5370",
      "editorOverviewRuler.border": "#2d2d2d",
      "editorRuler.foreground": "#2d2d2d",
      "editorSuggestWidget.background": "#1a1a1a",
      "editorSuggestWidget.border": "#2d2d2d",
      "editorSuggestWidget.foreground": "#e0e0e0",
      "editorSuggestWidget.highlightForeground": "#82AAFF",
      "editorSuggestWidget.selectedBackground": "#3d3d3d",
    },
  });

  // Configure Rust language
  monaco.languages.setLanguageConfiguration("rust", {
    comments: {
      lineComment: "//",
      blockComment: ["/*", "*/"],
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      offSide: true,
      markers: {
        start: new RegExp("^\\s*//\\s*#?region\\b"),
        end: new RegExp("^\\s*//\\s*#?endregion\\b"),
      },
    },
    wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
  });

  // Configure TOML language
  monaco.languages.register({ id: "toml" });
  monaco.languages.setLanguageConfiguration("toml", {
    comments: {
      lineComment: "#",
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });

  // Set up Rust language features
  monaco.languages.registerCompletionItemProvider("rust", {
    provideCompletionItems: () => {
      const suggestions = [
        // Keywords
        { label: "fn", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "fn ", documentation: "Define a function" },
        { label: "let", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "let ", documentation: "Declare a variable" },
        { label: "mut", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "mut ", documentation: "Mutable binding" },
        { label: "const", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "const ", documentation: "Define a constant" },
        { label: "static", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "static ", documentation: "Define a static variable" },
        { label: "struct", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "struct ", documentation: "Define a struct" },
        { label: "enum", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "enum ", documentation: "Define an enum" },
        { label: "trait", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "trait ", documentation: "Define a trait" },
        { label: "impl", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "impl ", documentation: "Implement a trait or inherent methods" },
        { label: "match", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "match ", documentation: "Pattern matching" },
        { label: "if", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "if ", documentation: "Conditional expression" },
        { label: "else", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "else", documentation: "Else branch" },
        { label: "while", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "while ", documentation: "While loop" },
        { label: "for", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "for ", documentation: "For loop" },
        { label: "loop", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "loop", documentation: "Infinite loop" },
        { label: "return", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "return", documentation: "Return from function" },
        { label: "pub", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "pub ", documentation: "Public visibility" },
        { label: "use", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "use ", documentation: "Import items" },
        { label: "mod", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "mod ", documentation: "Define a module" },
        { label: "crate", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "crate::", documentation: "Crate root" },
        { label: "self", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "self", documentation: "Current module" },
        { label: "super", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "super::", documentation: "Parent module" },
        { label: "as", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "as ", documentation: "Type cast or alias" },
        { label: "move", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "move ", documentation: "Move closure" },
        { label: "async", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "async ", documentation: "Async function/block" },
        { label: "await", kind: monaco.languages.CompletionItemKind.Keyword, insertText: ".await", documentation: "Await future" },

        // Common types
        { label: "String", kind: monaco.languages.CompletionItemKind.Type, insertText: "String", documentation: "Owned string type" },
        { label: "Vec", kind: monaco.languages.CompletionItemKind.Type, insertText: "Vec<>" },
        { label: "Option", kind: monaco.languages.CompletionItemKind.Type, insertText: "Option<>" },
        { label: "Result", kind: monaco.languages.CompletionItemKind.Type, insertText: "Result<>" },
        { label: "Box", kind: monaco.languages.CompletionItemKind.Type, insertText: "Box<>" },
        { label: "Rc", kind: monaco.languages.CompletionItemKind.Type, insertText: "Rc<>" },
        { label: "Arc", kind: monaco.languages.CompletionItemKind.Type, insertText: "Arc<>" },

        // Common macros
        { label: "println!", kind: monaco.languages.CompletionItemKind.Function, insertText: 'println!("$1")' },
        { label: "print!", kind: monaco.languages.CompletionItemKind.Function, insertText: 'print!("$1")' },
        { label: "format!", kind: monaco.languages.CompletionItemKind.Function, insertText: 'format!("$1")' },
        { label: "vec!", kind: monaco.languages.CompletionItemKind.Function, insertText: "vec![$1]" },
        { label: "dbg!", kind: monaco.languages.CompletionItemKind.Function, insertText: "dbg!($1)" },
        { label: "todo!", kind: monaco.languages.CompletionItemKind.Function, insertText: "todo!()" },
        { label: "panic!", kind: monaco.languages.CompletionItemKind.Function, insertText: 'panic!("$1")' },
        { label: "assert!", kind: monaco.languages.CompletionItemKind.Function, insertText: "assert!($1)" },
        { label: "assert_eq!", kind: monaco.languages.CompletionItemKind.Function, insertText: "assert_eq!($1, $2)" },
      ];
      return { suggestions };
    },
  });

  // Set up TOML language features
  monaco.languages.registerCompletionItemProvider("toml", {
    provideCompletionItems: () => {
      const suggestions = [
        // Cargo.toml specific
        { label: "[package]", kind: monaco.languages.CompletionItemKind.Snippet, insertText: '[package]\nname = "$1"\nversion = "0.1.0"\nedition = "2021"\n' },
        { label: "[dependencies]", kind: monaco.languages.CompletionItemKind.Snippet, insertText: '[dependencies]\n$1 = "$2"' },
        { label: "[dev-dependencies]", kind: monaco.languages.CompletionItemKind.Snippet, insertText: '[dev-dependencies]\n$1 = "$2"' },
        { label: "[features]", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "[features]\ndefault = []\n$1 = []" },
        { label: "[workspace]", kind: monaco.languages.CompletionItemKind.Snippet, insertText: '[workspace]\nmembers = [\n    "$1",\n]' },

        // Common keys
        { label: "name", kind: monaco.languages.CompletionItemKind.Property, insertText: 'name = "$1"' },
        { label: "version", kind: monaco.languages.CompletionItemKind.Property, insertText: 'version = "$1"' },
        { label: "edition", kind: monaco.languages.CompletionItemKind.Property, insertText: 'edition = "$1"' },
        { label: "authors", kind: monaco.languages.CompletionItemKind.Property, insertText: 'authors = ["$1"]' },
        { label: "description", kind: monaco.languages.CompletionItemKind.Property, insertText: 'description = "$1"' },
        { label: "license", kind: monaco.languages.CompletionItemKind.Property, insertText: 'license = "$1"' },
        { label: "repository", kind: monaco.languages.CompletionItemKind.Property, insertText: 'repository = "$1"' },
        { label: "homepage", kind: monaco.languages.CompletionItemKind.Property, insertText: 'homepage = "$1"' },
        { label: "documentation", kind: monaco.languages.CompletionItemKind.Property, insertText: 'documentation = "$1"' },
      ];
      return { suggestions };
    },
  });
};

// Initialize Monaco configuration
configureMonaco();

const Editor = ({ fileId, filePath, content = "", language = "rust", onChange }) => {
  // Determine file type
  const fileType = getFileType(filePath);

  // Render image viewer for image files
  if (fileType === "image") {
    return <ImageViewer filePath={filePath} content={content} />;
  }

  // Render PDF viewer for PDF files
  if (fileType === "pdf") {
    return <PDFViewer filePath={filePath} content={content} />;
  }

  // Otherwise use Monaco editor for code files
  return <CodeEditor fileId={fileId} filePath={filePath} content={content} language={language} onChange={onChange} />;
};

// Separate component for Monaco editor to avoid hook issues
const CodeEditor = ({ fileId, filePath, content, language, onChange }) => {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!editorRef.current) {
      editorRef.current = monaco.editor.create(containerRef.current, {
        value: content,
        language,
        theme: "community-material",
        automaticLayout: true,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace",
        fontSize: 16,
        lineHeight: 26,
        minimap: {
          enabled: true,
          scale: 1,
          showSlider: "mouseover",
          side: "right",
        },
        scrollbar: {
          alwaysConsumeMouseWheel: false,
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: "blink",
        cursorSmoothCaretAnimation: true,
        renderLineHighlight: "all",
        lineNumbers: "on",
        folding: true,
        foldingHighlight: true,
        showFoldingControls: "mouseover",
        bracketPairColorization: {
          enabled: true,
        },
        guides: {
          bracketPairs: true,
          bracketPairsHorizontal: true,
          highlightActiveBracketPair: true,
          highlightActiveIndentation: true,
        },
        autoIndent: "full",
        formatOnPaste: true,
        formatOnType: true,
        suggest: {
          showKeywords: true,
          showSnippets: true,
          showFunctions: true,
          showVariables: true,
          showClasses: true,
          showColors: true,
          showFiles: true,
          showFolders: true,
          showMethods: true,
          showEvents: true,
          showOperators: true,
          showUnits: true,
          showValues: true,
          showConstants: true,
          showEnumMembers: true,
          showStructs: true,
          showTypeParameters: true,
          showReferences: true,
          showIssues: true,
          showUsers: true,
        },
        quickSuggestions: {
          other: true,
          comments: true,
          strings: true,
        },
        parameterHints: {
          enabled: true,
          cycle: true,
        },
        hover: {
          enabled: true,
          delay: 300,
        },
        links: true,
        matchBrackets: "always",
        tabSize: 4,
        insertSpaces: true,
        detectIndentation: true,
        trimAutoWhitespace: true,
        wordWrap: "off",
        wordWrapColumn: 80,
        rulers: [],
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: false,
        renderWhitespace: "none",
        renderControlCharacters: false,
        renderIndentGuides: true,
        highlightActiveIndentGuide: true,
        snippetSuggestions: "inline",
        semanticHighlighting: {
          enabled: true,
        },
      });

      const changeDisposable = editorRef.current.onDidChangeModelContent(() => {
        if (isUpdatingRef.current) return;
        onChange?.(editorRef.current.getValue());
      });

      return () => {
        changeDisposable.dispose();
        editorRef.current.dispose();
        editorRef.current = null;
      };
    }
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) return;
    const path = filePath ? `file://${filePath}` : `untitled://${fileId ?? "scratch"}`;
    const uri = monaco.Uri.parse(path);
    let model = monaco.editor.getModel(uri);

    isUpdatingRef.current = true;
    if (!model) {
      model = monaco.editor.createModel(content, language, uri);
    } else if (content !== undefined && model.getValue() !== content) {
      model.setValue(content);
    }
    monaco.editor.setModelLanguage(model, language);
    editorRef.current.setModel(model);
    isUpdatingRef.current = false;
  }, [fileId, filePath, content, language]);

  return <div className="editor-container" ref={containerRef} />;
};

export default Editor;
