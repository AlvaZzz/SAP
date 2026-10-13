'use client';

import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

/**
 * Editor de código Python (CodeMirror 6) con resaltado y números de línea.
 * Mantiene tema oscuro tipo "terminal" en modo claro y oscuro para máxima
 * legibilidad del código.
 */
export function CodeEditor({
  value, onChange, readOnly = false, height = '360px', className = '',
}: {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  height?: string;
  className?: string;
}) {
  return (
    <div className={`h-full overflow-hidden ${className}`}>
      <CodeMirror
        value={value}
        height={height}
        theme={oneDark}
        extensions={[python()]}
        editable={!readOnly}
        readOnly={readOnly}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: !readOnly }}
        style={{
          fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.875rem',
          lineHeight: 1.55,
          height: '100%',
        }}
      />
    </div>
  );
}
