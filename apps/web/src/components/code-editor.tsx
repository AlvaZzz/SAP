'use client';

import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';

/** Editor de código Python (CodeMirror 6) con resaltado y números de línea. */
export function CodeEditor({
  value, onChange, readOnly = false, height = '360px',
}: {
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  height?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700">
      <CodeMirror
        value={value}
        height={height}
        theme="dark"
        extensions={[python()]}
        editable={!readOnly}
        readOnly={readOnly}
        onChange={onChange}
        basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: !readOnly }}
        style={{ fontSize: 14 }}
      />
    </div>
  );
}
