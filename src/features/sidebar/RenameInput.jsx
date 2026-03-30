import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { FileIconImg, FolderIconImg } from '../../components/icons/FileIcon';

/**
 * Rename input for renaming files/folders in the sidebar tree.
 */
const RenameInput = memo(({ type, depth, onSubmit, onCancel, defaultValue = '' }) => {
  const inputRef = useRef(null);
  const [value, setValue] = useState(defaultValue);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    inputRef.current?.focus();
    inputRef.current?.select();
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        const trimmed = value.trim();
        if (trimmed) onSubmit(trimmed);
        else onCancel();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [value, onSubmit, onCancel]
  );

  const handleBlur = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== defaultValue) {
      onSubmit(trimmed);
    } else {
      onCancel();
    }
  }, [value, defaultValue, onSubmit, onCancel]);

  const indent = depth * 18;
  const isFolder = type === 'folder';

  return (
    <div
      className={`sidebar-inline-input rename-input ${isVisible ? 'visible' : ''}`}
      style={{ paddingLeft: `${indent + (isFolder ? 12 : 40)}px` }}
    >
      <span className="sidebar-node-icon">
        {isFolder
          ? <FolderIconImg folderName="" isOpen={false} size={16} />
          : <FileIconImg filename={value || 'file.txt'} size={16} />
        }
      </span>
      <input
        ref={inputRef}
        type="text"
        className="sidebar-inline-input-field"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
});

export default RenameInput;
