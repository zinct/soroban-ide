import React from 'react';
import { getFileType } from './editorUtils';
import CodeEditor from './CodeEditor';
import ImageViewer from './ImageViewer';
import PdfViewer from './PdfViewer';

/**
 * Editor orchestrator — routes to the appropriate viewer
 * based on file type (code, image, PDF).
 */
const Editor = ({ fileId, filePath, content = '', language = 'rust', onChange }) => {
  const fileType = getFileType(filePath);

  if (fileType === 'image') {
    return <ImageViewer filePath={filePath} content={content} />;
  }

  if (fileType === 'pdf') {
    return <PdfViewer filePath={filePath} content={content} />;
  }

  return (
    <CodeEditor
      fileId={fileId}
      filePath={filePath}
      content={content}
      language={language}
      onChange={onChange}
    />
  );
};

export default Editor;
