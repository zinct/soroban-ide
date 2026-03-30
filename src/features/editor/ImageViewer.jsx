import React, { useMemo } from 'react';

const ImageViewer = ({ filePath, content }) => {
  const dataUrl = useMemo(() => {
    if (!content) return null;
    if (content.startsWith('data:')) return content;

    const ext = filePath?.split('.').pop()?.toLowerCase() || 'png';
    const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mimeType};base64,${content}`;
  }, [filePath, content]);

  if (!dataUrl) {
    return (
      <div className="binary-viewer">
        <div className="binary-message">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p>Cannot display image</p>
        </div>
      </div>
    );
  }

  return (
    <div className="image-viewer">
      <img src={dataUrl} alt={filePath} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  );
};

export default ImageViewer;
