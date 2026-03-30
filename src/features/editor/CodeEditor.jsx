import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import './editorConfig'; // Side-effect: configures Monaco theme + languages

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
        theme: 'community-material',
        automaticLayout: true,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace",
        fontSize: 16,
        lineHeight: 26,
        minimap: { enabled: true, scale: 1, showSlider: 'mouseover', side: 'right' },
        scrollbar: { alwaysConsumeMouseWheel: false, verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'blink',
        cursorSmoothCaretAnimation: true,
        renderLineHighlight: 'all',
        lineNumbers: 'on',
        folding: true,
        foldingHighlight: true,
        showFoldingControls: 'mouseover',
        bracketPairColorization: { enabled: true },
        guides: {
          bracketPairs: true,
          bracketPairsHorizontal: true,
          highlightActiveBracketPair: true,
          highlightActiveIndentation: true,
        },
        autoIndent: 'full',
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
        matchBrackets: 'always',
        tabSize: 4,
        insertSpaces: true,
        detectIndentation: true,
        trimAutoWhitespace: true,
        wordWrap: 'off',
        overviewRulerBorder: false,
        renderWhitespace: 'none',
        snippetSuggestions: 'inline',
        semanticHighlighting: { enabled: true },
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
    const path = filePath ? `file://${filePath}` : `untitled://${fileId ?? 'scratch'}`;
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

export default CodeEditor;
