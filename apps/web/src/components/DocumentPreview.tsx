import { useEffect, useRef, useState } from 'react';
import type { CandidateDocumentDto } from '@job-agent/shared';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { candidateApi } from '../api/candidate-client.js';
import { Button, Icon } from '../ui/Primitives.js';
import styles from './DocumentPreview.module.css';

const docxShell =
  "<!doctype html><html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data: blob:; font-src data: blob:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\"><style>html{color-scheme:light}body{margin:0;color:#101010;background:#fff;font:14px Arial,sans-serif}.docx-wrapper{padding:16px!important;background:#fff!important}section.docx{box-shadow:none!important;max-width:100%!important}a{pointer-events:none}</style></head><body></body></html>";
export function DocumentPreview({
  document: doc,
  onClose,
}: {
  document: CandidateDocumentDto;
  onClose: () => void;
}) {
  const [blob, setBlob] = useState<Blob | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [pages, setPages] = useState(1),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(100),
    [pageText, setPageText] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null),
    frame = useRef<HTMLIFrameElement>(null);
  const [readyFrame, setReadyFrame] = useState('');
  const frameKey = doc.id + ':' + attempt;
  const format =
    doc.mimeType === 'application/pdf'
      ? 'pdf'
      : doc.mimeType === 'text/plain'
        ? 'txt'
        : doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ? 'docx'
          : 'unsupported';
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let release: (() => void) | undefined;
    setLoading(true);
    setError('');
    setBlob(null);
    setPdf(null);
    setPage(1);
    setPages(1);
    setZoom(100);
    setPageText('');
    if (format === 'unsupported') {
      setLoading(false);
      setError('This file type cannot be previewed. Download the original to view it.');
      return () => controller.abort();
    }
    candidateApi
      .getDocumentBlob(doc.id, controller.signal)
      .then(async (data) => {
        if (!active) return;
        if (format === 'pdf') {
          const library = await import('pdfjs-dist');
          library.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url,
          ).toString();
          if (!active) return;
          const bytes = new Uint8Array(await data.arrayBuffer());
          if (!active) return;
          const task = library.getDocument({
            data: bytes,
            isEvalSupported: false,
            cMapUrl: '/assets/pdfjs/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: '/assets/pdfjs/standard_fonts/',
            wasmUrl: '/assets/pdfjs/wasm/',
          });
          release = () => {
            void task.destroy();
          };
          const document = await task.promise;
          if (active) {
            setPdf(document);
            setPages(document.numPages);
            setLoading(false);
          } else await document.destroy();
        } else if (format === 'txt') {
          const text = await data.text();
          if (active) {
            setPageText(text);
            setLoading(false);
          }
        } else if (active) setBlob(data);
      })
      .catch((err) => {
        if (active && !controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Preview unavailable');
          setLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
      release?.();
    };
  }, [doc.id, format, attempt]);
  useEffect(() => {
    if (!pdf) return;
    let active = true;
    let cancel: (() => void) | undefined;
    pdf
      .getPage(page)
      .then(async (pdfPage) => {
        if (!active || !canvas.current) return;
        const viewport = pdfPage.getViewport({ scale: (zoom / 100) * 1.15 }),
          node = canvas.current,
          dpr = window.devicePixelRatio || 1;
        node.width = Math.ceil(viewport.width * dpr);
        node.height = Math.ceil(viewport.height * dpr);
        node.style.width = viewport.width + 'px';
        node.style.height = viewport.height + 'px';
        const task = pdfPage.render({
          canvas: node,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        cancel = () => task.cancel();
        const text = await pdfPage.getTextContent();
        if (active)
          setPageText(text.items.map((item) => ('str' in item ? item.str : '')).join(' '));
        await task.promise;
      })
      .catch((err) => {
        if (active && err?.name !== 'RenderingCancelledException')
          setError('Could not render this page. You can still download the original.');
      });
    return () => {
      active = false;
      cancel?.();
    };
  }, [pdf, page, zoom]);
  useEffect(() => {
    if (format !== 'docx' || !blob || readyFrame !== frameKey || !frame.current?.contentDocument)
      return;
    let active = true;
    const target = frame.current.contentDocument;
    const styleContainer = target.createElement('div');
    target.head.appendChild(styleContainer);
    import('docx-preview')
      .then((library) => {
        if (!active) return;
        return library.renderAsync(blob, target.body, styleContainer, {
          renderAltChunks: false,
          useBase64URL: true,
          experimental: false,
          renderComments: false,
        });
      })
      .then(() => {
        if (!active) return;
        target.querySelectorAll('a').forEach((a) => {
          a.removeAttribute('href');
          a.removeAttribute('target');
        });
        target.querySelectorAll<HTMLElement>('.docx-wrapper').forEach((wrapper) => {
          wrapper.style.setProperty('background', '#fff', 'important');
          wrapper.style.setProperty('padding', '0', 'important');
        });
        target.querySelectorAll<HTMLElement>('section.docx').forEach((section) => {
          section.style.setProperty('box-shadow', 'none', 'important');
          section.style.setProperty('margin', '0', 'important');
        });
        const sections = target.querySelectorAll('section.docx');
        setPages(Math.max(1, sections.length));
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError('This document could not be previewed. Download the original to view it.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
      styleContainer.remove();
    };
  }, [format, blob, readyFrame, frameKey]);
  useEffect(() => {
    const target = frame.current?.contentDocument;
    if (format !== 'docx' || !target) return;
    target.documentElement.style.zoom = String(zoom / 100);
    target.querySelectorAll<HTMLElement>('section.docx').forEach((section, index) => {
      section.style.display = index === page - 1 ? '' : 'none';
    });
  }, [format, page, zoom, loading]);
  return (
    <section className={styles.preview} aria-label={'Preview of ' + doc.originalFilename}>
      <div className="section-toolbar">
        <div>
          <h3>{doc.originalFilename}</h3>
          <p className="page-subtitle">
            {format.toUpperCase()} · {Math.ceil(doc.sizeBytes / 1024)} KB
          </p>
        </div>
        <Button className="btn-ghost" onClick={onClose}>
          Close preview
        </Button>
      </div>
      <div className={styles.toolbar}>
        <Button
          className="btn-outline btn-sm"
          onClick={() => setPage((n) => n - 1)}
          disabled={page <= 1 || loading || !!error}
        >
          Previous
        </Button>
        <span aria-live="polite">
          Page {page} of {pages}
        </span>
        <Button
          className="btn-outline btn-sm"
          onClick={() => setPage((n) => n + 1)}
          disabled={page >= pages || loading || !!error}
        >
          Next
        </Button>
        <label>
          Zoom{' '}
          <select
            aria-label="Preview zoom"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            {[50, 75, 100, 125, 150, 200].map((n) => (
              <option key={n} value={n}>
                {n}%
              </option>
            ))}
          </select>
        </label>
        <a
          className="btn btn-outline btn-sm"
          href={candidateApi.getDocumentDownloadUrl(doc.id)}
          download
        >
          <Icon name="download" size={20} />
          Download
        </a>
      </div>
      {loading && <p role="status">Preparing your document…</p>}
      {error && (
        <div className="alert alert-error" role="alert">
          <p>{error}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>Retry preview</Button>
        </div>
      )}
      <div className={styles.paper} hidden={!!error}>
        {format === 'pdf' && (
          <>
            <canvas ref={canvas} role="img" aria-label={'Document page ' + page} />
            <p className={styles.accessibleText}>{pageText}</p>
          </>
        )}
        {format === 'txt' && <pre style={{ fontSize: (14 * zoom) / 100 }}>{pageText}</pre>}
        {format === 'docx' && (
          <iframe
            key={frameKey}
            className={styles.docx}
            ref={frame}
            title={'Document preview: ' + doc.originalFilename}
            sandbox="allow-same-origin"
            srcDoc={docxShell}
            onLoad={() => setReadyFrame(frameKey)}
          />
        )}
      </div>
      <p className={styles.note}>
        Preview formatting can differ from the original. Download the file for its original layout.
      </p>
    </section>
  );
}
