import React, { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { linter, lintGutter } from '@codemirror/lint';

const CodeEditor = ({ value, onChange, language = 'html', className = '' }) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Determine language extension
    let languageExtension;
    if (language === 'css') {
      languageExtension = css();
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
        syntaxHighlighting(defaultHighlightStyle),
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

        // Custom theme
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
  }, [language]); // Re-create editor when language changes

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
      className={`w-full h-full border border-gray-300 rounded overflow-hidden ${className}`}
    />
  );
};

export default CodeEditor;
