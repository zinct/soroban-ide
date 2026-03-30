import React, { useMemo } from 'react';

const PdfViewer = ({ filePath, content }) => {
  const dataUrl = useMemo(() => {
    if (!content) return null;
    if (content.startsWith('data:')) return content;
    return `data:application/pdf;base64,${content}`;
  }, [content]);

  if (!dataUrl) {
    return (
      <div className="binary-viewer">
        <div className="binary-message">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p>Cannot display PDF</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <iframe src={dataUrl} title="PDF Viewer" width="100%" height="100%" style={{ border: 'none' }} type="application/pdf" />
    </div>
  );
};

export default PdfViewer;
