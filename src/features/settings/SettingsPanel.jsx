import React, { useState, useEffect } from "react";
import { X, Palette, TextT, Cpu, Monitor } from "@phosphor-icons/react";

const SettingsPanel = ({ currentTheme, onThemeChange, onClose }) => {
  const [activeTab, setActiveTab] = useState("appearance");

  // Handle ESC key to close settings
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const themes = [
    { id: "dark", name: "Community Dark", class: "preview-dark" },
    { id: "light", name: "Modern Light", class: "preview-light" },
  ];

  const renderAppearance = () => (
    <div className="settings-section">
      <h3>Color Theme</h3>
      <div className="settings-item">
        <div className="settings-item-label">Global Theme</div>
        <div className="settings-item-description">Select the primary color palette for the entire IDE.</div>
        <div className="theme-grid">
          {themes.map((theme) => (
            <div
              key={theme.id}
              className={`theme-card ${currentTheme === theme.id ? "active" : ""}`}
              onClick={() => onThemeChange(theme.id)}
            >
              <div className={`theme-preview ${theme.class}`}>
                <div className="preview-sidebar" />
                <div className="preview-editor" />
              </div>
              <span>{theme.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderEditor = () => (
    <div className="settings-section">
      <h3>Editor Settings</h3>
      <div className="settings-item">
        <div className="settings-item-label">Font Family</div>
        <div className="settings-item-description">Controls the font used in the editor and terminal.</div>
        <input type="text" className="sidebar-inline-input-field" disabled value="JetBrains Mono, Fira Code" style={{ marginTop: "8px", width: "100%", maxWidth: "400px" }} />
      </div>
      <div className="settings-item">
        <div className="settings-item-label">Font Size</div>
        <div className="settings-item-description">Adjust the size of the editor text (Coming soon).</div>
        <input type="number" className="sidebar-inline-input-field" disabled value="14" style={{ marginTop: "8px", width: "100px" }} />
      </div>
    </div>
  );

  return (
    <div className="settings-panel">
      <div className="settings-nav">
        <div className="settings-nav-title">Settings</div>
        
        <div 
          className={`settings-nav-item ${activeTab === "appearance" ? "active" : ""}`}
          onClick={() => setActiveTab("appearance")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Palette size={16} /> Appearance
          </div>
        </div>

        <div 
          className={`settings-nav-item ${activeTab === "editor" ? "active" : ""}`}
          onClick={() => setActiveTab("editor")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <TextT size={16} /> Editor
          </div>
        </div>

        <div className="settings-nav-item" style={{ opacity: 0.5, cursor: "not-allowed" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Monitor size={16} /> Accessibility
          </div>
        </div>
        
        <div className="settings-nav-item" style={{ opacity: 0.5, cursor: "not-allowed" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Cpu size={16} /> Performance
          </div>
        </div>

      </div>

      <div className="settings-content">
        {/* Global Close Button - Fixed to top right of page */}
        <button 
          onClick={onClose}
          className="sidebar-action" 
          style={{ 
            position: "absolute",
            top: "24px",
            right: "24px",
            width: "32px", 
            height: "32px", 
            fontSize: "20px",
            zIndex: 100
          }}
          title="Close Settings (ESC)"
        >
          <X size={20} />
        </button>

        <div className="settings-header">
          <h2>Settings</h2>
          <p>Configure Soroban Studio to match your workflow.</p>
        </div>

        {activeTab === "appearance" && renderAppearance()}
        {activeTab === "editor" && renderEditor()}
      </div>
    </div>
  );
};

export default SettingsPanel;
