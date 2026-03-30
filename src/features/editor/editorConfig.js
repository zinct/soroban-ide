/**
 * Monaco editor configuration.
 * Theme definition and language support setup.
 */

import * as monaco from 'monaco-editor';

export const configureMonaco = () => {
  // Community Material Theme - Darker
  monaco.editor.defineTheme('community-material', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'e0e0e0', background: '1a1a1a' },
      { token: 'keyword', foreground: 'C792EA', fontStyle: 'bold' },
      { token: 'keyword.control', foreground: 'C792EA' },
      { token: 'keyword.operator', foreground: '89DDFF' },
      { token: 'string', foreground: 'C3E88D' },
      { token: 'string.escape', foreground: 'F78C6C' },
      { token: 'comment', foreground: '616161' },
      { token: 'comment.doc', foreground: '616161' },
      { token: 'number', foreground: 'F78C6C' },
      { token: 'regexp', foreground: 'C3E88D' },
      { token: 'type', foreground: '82AAFF' },
      { token: 'class', foreground: 'FFCB6B', fontStyle: 'bold' },
      { token: 'function', foreground: '82AAFF' },
      { token: 'variable', foreground: 'FF5370' },
      { token: 'property', foreground: 'FF5370' },
      { token: 'tag', foreground: 'FF5370' },
      { token: 'attribute.name', foreground: 'FFCB6B' },
      { token: 'attribute.value', foreground: 'C3E88D' },
      { token: 'operator', foreground: '89DDFF' },
      { token: 'delimiter', foreground: '89DDFF' },
      { token: 'namespace', foreground: 'B2CCD6' },
      { token: 'constant', foreground: 'F78C6C' },
    ],
    colors: {
      'editor.background': '#1a1a1a',
      'editor.foreground': '#e0e0e0',
      'editorLineNumber.foreground': '#424242',
      'editorLineNumber.activeForeground': '#e0e0e0',
      'editor.selectionBackground': '#3d3d3d',
      'editor.inactiveSelectionBackground': '#2a2a2a',
      'editor.lineHighlightBackground': '#212121',
      'editor.lineHighlightBorder': '#2d2d2d',
      'editor.findMatchBackground': '#F78C6C66',
      'editor.findMatchHighlightBackground': '#C792EA66',
      'editorBracketMatch.background': '#2a2a2a',
      'editorBracketMatch.border': '#89DDFF',
      'editorGutter.background': '#1a1a1a',
      'editorGutter.modifiedBackground': '#82AAFF',
      'editorGutter.addedBackground': '#C3E88D',
      'editorGutter.deletedBackground': '#FF5370',
      'editorSuggestWidget.background': '#1a1a1a',
      'editorSuggestWidget.border': '#2d2d2d',
      'editorSuggestWidget.foreground': '#e0e0e0',
      'editorSuggestWidget.highlightForeground': '#82AAFF',
      'editorSuggestWidget.selectedBackground': '#3d3d3d',
    },
  });

  // Rust language config
  monaco.languages.setLanguageConfiguration('rust', {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    folding: {
      offSide: true,
      markers: {
        start: new RegExp('^\\s*//\\s*#?region\\b'),
        end: new RegExp('^\\s*//\\s*#?endregion\\b'),
      },
    },
  });

  // TOML language
  monaco.languages.register({ id: 'toml' });
  monaco.languages.setLanguageConfiguration('toml', {
    comments: { lineComment: '#' },
    brackets: [
      ['{', '}'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });

  // Rust completions
  monaco.languages.registerCompletionItemProvider('rust', {
    provideCompletionItems: () => {
      const keywords = [
        'fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'trait',
        'impl', 'match', 'if', 'else', 'while', 'for', 'loop', 'return',
        'pub', 'use', 'mod', 'crate', 'self', 'super', 'as', 'move',
        'async', 'await',
      ];
      const types = ['String', 'Vec', 'Option', 'Result', 'Box', 'Rc', 'Arc'];
      const macros = ['println!', 'format!', 'vec!', 'dbg!', 'todo!', 'panic!', 'assert!', 'assert_eq!'];

      const suggestions = [
        ...keywords.map((k) => ({
          label: k,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: `${k} `,
        })),
        ...types.map((t) => ({
          label: t,
          kind: monaco.languages.CompletionItemKind.Type,
          insertText: `${t}<>`,
        })),
        ...macros.map((m) => ({
          label: m,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: m.endsWith('!') ? `${m.slice(0, -1)}!($1)` : m,
        })),
      ];
      return { suggestions };
    },
  });

  // TOML completions
  monaco.languages.registerCompletionItemProvider('toml', {
    provideCompletionItems: () => {
      const suggestions = [
        { label: '[package]', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '[package]\nname = "$1"\nversion = "0.1.0"\nedition = "2021"\n' },
        { label: '[dependencies]', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '[dependencies]\n$1 = "$2"' },
        { label: '[dev-dependencies]', kind: monaco.languages.CompletionItemKind.Snippet, insertText: '[dev-dependencies]\n$1 = "$2"' },
      ];
      return { suggestions };
    },
  });
};

// Run configuration immediately on import
configureMonaco();
