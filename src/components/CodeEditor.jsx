import React, { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, HighlightStyle } from '@codemirror/language';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';
import { tags } from '@lezer/highlight';

// Atom One Dark color palette
const bg = "#282c34";
const fg = "#abb2bf";
const comment = "#5c6370";
const keyword = "#c678dd";
const string = "#98c379";
const number = "#d19a66";
const fn = "#61aeee";
const type = "#e6c07b";
const attr = "#79c0ff";
const cyan = "#56b6c2";

// Dark theme — #282c34 background, Atom One Dark colors
const darkTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    backgroundColor: bg,
    color: fg
  },
  ".cm-content": { caretColor: "#528bff" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#528bff" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: "#3E4451" },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
    scrollbarWidth: "thin",
    scrollbarColor: "rgba(255,255,255,0.2) transparent"
  },
  ".cm-scroller::-webkit-scrollbar": { width: "8px", height: "8px" },
  ".cm-scroller::-webkit-scrollbar-track": { background: "transparent" },
  ".cm-scroller::-webkit-scrollbar-thumb": { background: "rgba(255,255,255,0.15)", borderRadius: "4px" },
  ".cm-scroller::-webkit-scrollbar-thumb:hover": { background: "rgba(255,255,255,0.3)" },
  ".cm-gutters": { backgroundColor: bg, color: "#636d83", border: "none" },
  ".cm-activeLineGutter": { backgroundColor: "#2c313a" },
  ".cm-activeLine": { backgroundColor: "#2c313a" },
  ".cm-line": { padding: "0 4px" },
  ".cm-matchingBracket": { backgroundColor: "#bad0f847", outline: "none" },
  ".cm-foldGutter": { color: "#636d83" },
  ".cm-foldPlaceholder": { backgroundColor: "transparent", border: "none", color: "#ddd" },
  ".cm-searchMatch": { backgroundColor: "#72a1ff59", outline: "1px solid #457dff" },
  ".cm-selectionMatch": { backgroundColor: "#aafe661a" },
  ".cm-tooltip": { border: "none", backgroundColor: "#353a42" },
  ".cm-tooltip-autocomplete": { "& > ul > li[aria-selected]": { backgroundColor: "#2c313a", color: fg } }
}, { dark: true });

// Complete Atom One Dark highlight style — covers ALL tags
const darkHighlight = HighlightStyle.define([
  // Comments — muted gray
  { tag: tags.comment, color: comment, fontStyle: "italic" },
  { tag: tags.meta, color: comment },

  // Keywords — purple/pink
  { tag: tags.keyword, color: keyword },
  { tag: [tags.operatorKeyword, tags.modifier, tags.definitionKeyword], color: keyword },
  { tag: tags.processingInstruction, color: keyword },

  // Strings — green
  { tag: tags.string, color: string },
  { tag: [tags.special(tags.string), tags.inserted], color: string },
  { tag: tags.attributeValue, color: string },

  // Numbers/Literals — orange
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: number },
  { tag: tags.literal, color: number },

  // Functions/Titles — light blue
  { tag: tags.function(tags.variableName), color: fn },
  { tag: tags.labelName, color: fn },
  { tag: tags.definition(tags.variableName), color: fn },

  // Built-ins/Types/Tags — yellow
  { tag: [tags.typeName, tags.className, tags.namespace], color: type },
  { tag: [tags.constant(tags.name), tags.standard(tags.name)], color: type },
  { tag: tags.tagName, color: type },
  { tag: tags.self, color: type },
  { tag: tags.macroName, color: type },

  // Attributes/Operators — blue
  { tag: tags.attributeName, color: attr },
  { tag: [tags.operator, tags.derefOperator], color: attr },

  // Regexp/Symbols — cyan
  { tag: [tags.regexp, tags.escape], color: cyan },
  { tag: tags.special(tags.variableName), color: cyan },
  { tag: tags.link, color: cyan, textDecoration: "underline" },

  // Default text — light gray (variables, properties, identifiers)
  { tag: [tags.name, tags.variableName, tags.propertyName], color: fg },
  { tag: [tags.definition(tags.propertyName), tags.separator], color: fg },
  { tag: [tags.local(tags.variableName), tags.character, tags.deleted, tags.changed, tags.annotation], color: fg },
  { tag: [tags.angleBracket, tags.contentSeparator, tags.color], color: fg },
  { tag: tags.url, color: fg, textDecoration: "underline" },

  // Formatting
  { tag: tags.heading, fontWeight: "bold", color: fn },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.invalid, color: "#ff6b6b" },
]);

const CodeEditor = ({ value, onChange, language = 'html', className = '', theme = 'light' }) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Determine language extension
    let languageExtension;
    if (language === 'css') {
      languageExtension = css();
    } else if (language === 'javascript') {
      languageExtension = javascript();
    } else if (language === 'json') {
      languageExtension = json();
    } else {
      languageExtension = html();
    }

    // Create editor state
    const state = EditorState.create({
      doc: value || '',
      extensions: [
        // Line numbers and gutters
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        foldGutter(),
        lintGutter(),

        // Language support
        languageExtension,
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),

        // Search and autocomplete
        highlightSelectionMatches(),
        autocompletion(),

        // History
        history(),

        // Keymaps
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap
        ]),

        // Line wrapping
        EditorView.lineWrapping,

        // Update listener
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newValue = update.state.doc.toString();
            onChange(newValue);
          }
        }),

        // Theme — dark mode gets its own complete highlight style (no defaultHighlightStyle)
        ...(theme === 'dark' ? [
          darkTheme,
          syntaxHighlighting(darkHighlight)
        ] : [
          syntaxHighlighting(defaultHighlightStyle),
          EditorView.theme({
            "&": {
              height: "100%",
              fontSize: "14px"
            },
            ".cm-scroller": {
              overflow: "auto",
              fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace"
            },
            ".cm-gutters": {
              backgroundColor: "#f5f5f5",
              color: "#999",
              border: "none"
            },
            ".cm-activeLineGutter": {
              backgroundColor: "#e8e8e8"
            },
            ".cm-line": {
              padding: "0 4px"
            }
          })
        ])
      ]
    });

    // Create editor view
    const view = new EditorView({
      state,
      parent: editorRef.current
    });

    viewRef.current = view;

    // Cleanup
    return () => {
      view.destroy();
    };
  }, [language, theme]); // Re-create editor when language or theme changes

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: value || ''
        }
      });
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      className={`w-full h-full overflow-hidden ${theme === 'dark' ? '' : 'border border-gray-300 rounded'} ${className}`}
    />
  );
};

export default CodeEditor;
