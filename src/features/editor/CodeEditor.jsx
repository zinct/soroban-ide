import React, { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import "./editorConfig"; // Side-effect: configures Monaco theme + languages

const CodeEditor = ({ fileId, filePath, content, language, theme, onChange, onCursorChange }) => {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onCursorChangeRef = useRef(onCursorChange);

  // Keep callbacks up to date
  useEffect(() => {
    onChangeRef.current = onChange;
    onCursorChangeRef.current = onCursorChange;
  }, [onChange, onCursorChange]);

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
        minimap: { enabled: true, scale: 1, showSlider: "mouseover", side: "right" },
        scrollbar: {
          alwaysConsumeMouseWheel: false,
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          useShadows: false,
          verticalHasArrows: false,
          horizontalHasArrows: false,
        },
        scrollBeyondLastLine: false,
        smoothScrolling: false,
        cursorBlinking: "blink",
        cursorSmoothCaretAnimation: true,
        renderLineHighlight: "all",
        lineNumbers: "on",
        folding: true,
        foldingHighlight: true,
        showFoldingControls: "mouseover",
        bracketPairColorization: { enabled: false },
        guides: {
          bracketPairs: false,
          bracketPairsHorizontal: false,
          highlightActiveBracketPair: false,
          highlightActiveIndentation: false,
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
        },
        quickSuggestions: { other: true, comments: true, strings: true },
        parameterHints: { enabled: true, cycle: true },
        hover: { enabled: true, delay: 300 },
        links: true,
        matchBrackets: "always",
        tabSize: 4,
        insertSpaces: true,
        detectIndentation: true,
        trimAutoWhitespace: true,
        wordWrap: "off",
        padding: { top: 20, bottom: 20 },
        overviewRulerBorder: false,
        renderWhitespace: "none",
        snippetSuggestions: "inline",
        semanticHighlighting: { enabled: true },
      });

      const changeDisposable = editorRef.current.onDidChangeModelContent(() => {
        if (isUpdatingRef.current) return;
        onChangeRef.current?.(editorRef.current.getValue());
      });

      // Track cursor position changes
      const cursorDisposable = editorRef.current.onDidChangeCursorPosition(() => {
        const position = editorRef.current.getPosition();
        const selection = editorRef.current.getSelection();
        let selectedChars = 0;
        if (selection && !selection.isEmpty()) {
          const model = editorRef.current.getModel();
          selectedChars = model.getValueLengthInRange(selection);
        }
        onCursorChangeRef.current?.({
          lineNumber: position?.lineNumber || 1,
          column: position?.column || 1,
          selectedChars,
        });
      });

      // Track selection changes
      const selectionDisposable = editorRef.current.onDidChangeCursorSelection(() => {
        const position = editorRef.current.getPosition();
        const selection = editorRef.current.getSelection();
        let selectedChars = 0;
        if (selection && !selection.isEmpty()) {
          const model = editorRef.current.getModel();
          selectedChars = model.getValueLengthInRange(selection);
        }
        onCursorChangeRef.current?.({
          lineNumber: position?.lineNumber || 1,
          column: position?.column || 1,
          selectedChars,
        });
      });

      return () => {
        changeDisposable.dispose();
        cursorDisposable.dispose();
        selectionDisposable.dispose();
        editorRef.current.dispose();
        editorRef.current = null;
      };
    }
  }, []); // Empty deps - only create editor once

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

  // Handle programmatically inserting text at cursor (e.g. inserting images)
  useEffect(() => {
    const handleInsertText = (e) => {
      const { text, fileId: targetFileId } = e.detail;
      if (targetFileId !== fileId) return;
      if (editorRef.current) {
        const selection = editorRef.current.getSelection();
        const range = new monaco.Range(
          selection.startLineNumber,
          selection.startColumn,
          selection.endLineNumber,
          selection.endColumn
        );
        const id = { major: 1, minor: 1 };
        const textOp = { identifier: id, range: range, text: text, forceMoveMarkers: true };
        editorRef.current.executeEdits("insert-text", [textOp]);
      }
    };
    window.addEventListener("soroban:insertText", handleInsertText);
    return () => window.removeEventListener("soroban:insertText", handleInsertText);
  }, [fileId]);

  // Handle Theme changes
  useEffect(() => {
    if (!theme) return;
    const monacoTheme = theme === "light" ? "vs" : "community-material";
    monaco.editor.setTheme(monacoTheme);
  }, [theme]);

  return <div className="editor-container" ref={containerRef} />;
};

export default CodeEditor;
