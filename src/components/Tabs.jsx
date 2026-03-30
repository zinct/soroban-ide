import React, { memo } from "react";

const Tabs = memo(({ tabs, activeFileId, previewTabId, files, onTabSelect, onTabClose }) => {
  if (!tabs.length) {
    return (
      <div className="tabs-bar tabs-empty">
        <span className="tabs-placeholder">Open a file to start editing</span>
      </div>
    );
  }

  return (
    <div className="tabs-bar tabs-filled">
      {tabs.map((tabId) => {
        const node = files.get(tabId);
        const label = node?.name ?? "Untitled";
        const isActive = activeFileId === tabId;
        const isPreview = previewTabId === tabId;

        return (
          <div key={tabId} className={`tab ${isActive ? "active" : ""} ${isPreview ? "preview" : ""}`} role="tab" tabIndex={0} onClick={() => onTabSelect(tabId)} onKeyDown={(event) => event.key === "Enter" && onTabSelect(tabId)}>
            <span className={`tab-label ${isPreview ? "preview-label" : ""}`}>{label}</span>
            <button
              type="button"
              className="tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onTabClose(tabId);
              }}
              aria-label={`Close ${label}`}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
});

export default Tabs;
