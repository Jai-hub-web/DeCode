import React, { useRef, useState, useEffect } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';

interface DCodeEditorProps {
  language: string;
  code: string;
  onChange: (value: string) => void;
}

const DCodeEditor: React.FC<DCodeEditorProps> = ({ language, code, onChange }) => {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;

    // Define the custom "Mono-Cyber" aesthetic theme
    monaco.editor.defineTheme('mono-cyber', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'type', foreground: '8be9fd' },
        { token: 'class', foreground: '8be9fd', fontStyle: 'bold' },
        { token: 'function', foreground: '50fa7b' },
        { token: 'variable', foreground: 'f8f8f2' },
        // The electric cobalt accent for specific elements
        { token: 'operator', foreground: '0055ff' },
      ],
      colors: {
        'editor.background': '#050505', // Deep obsidian background
        'editor.foreground': '#f8f8ff', // Ghost white text
        'editor.lineHighlightBackground': '#ffffff0a', // Extremely subtle line highlight
        'editorLineNumber.foreground': '#ffffff40',
        'editorLineNumber.activeForeground': '#0055ff', // Electric cobalt for active line number
        'editorCursor.foreground': '#0055ff', // Neon cobalt cursor
        'editor.selectionBackground': '#0055ff40', // Semi-transparent cobalt selection
        'editorIndentGuide.background': '#ffffff0a', // 1px thin dividers
        'editorIndentGuide.activeBackground': '#ffffff20',
        'editor.foldBackground': '#050505',
        'editorWidget.background': '#0a0a0a',
        'editorWidget.border': '#ffffff10',
      }
    });

    // Apply the theme immediately
    monaco.editor.setTheme('mono-cyber');
  };



  return (
    <div className="w-full h-full">
      <Editor
        height="100%"
        language={language}
        value={code}
        onChange={(val) => onChange(val || '')}
        theme="mono-cyber"
        onMount={handleEditorDidMount}
        options={{
          fontFamily: "'JetBrains Mono', 'Inter', monospace",
          fontSize: 14,
          fontLigatures: true,
          minimap: { enabled: false }, // Minimalist: disable minimap
          wordWrap: 'on',
          lineNumbersMinChars: 3,
          padding: { top: 24, bottom: 24 }, // Give it some breathing room
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          formatOnPaste: true,
          renderLineHighlight: 'all',
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
            useShadows: false, // 1px borders instead of shadows
          }
        }}
      />
    </div>
  );
};

export default DCodeEditor;
