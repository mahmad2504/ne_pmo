import { useEffect, useRef } from 'react';
import { sanitizeReportHtml } from '../reportHtml.js';

export default function RichTextEditor({ initialValue, onChange, disabled }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeReportHtml(initialValue);
  }, []);

  function emit() {
    onChange(ref.current?.innerHTML ?? '');
  }

  function run(command) {
    const node = ref.current;
    if (!node || disabled) return;
    node.focus();
    document.execCommand(command);
    emit();
  }

  return (
    <div className="rich-text">
      <div className="rich-text__toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" aria-label="Bold" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => run('bold')}>
          <strong>B</strong>
        </button>
        <button type="button" aria-label="Italic" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => run('italic')}>
          <em>I</em>
        </button>
        <button type="button" aria-label="Bullet list" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => run('insertUnorderedList')}>
          •
        </button>
        <button type="button" aria-label="Numbered list" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => run('insertOrderedList')}>
          1.
        </button>
      </div>
      <div
        ref={ref}
        className="rich-text__box"
        contentEditable={disabled ? 'false' : 'true'}
        role="textbox"
        aria-multiline="true"
        aria-label="Report"
        onInput={emit}
        suppressContentEditableWarning
      />
    </div>
  );
}
