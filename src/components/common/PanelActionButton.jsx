import React from "react";

/**
 * Reusable action button for panel headers (Terminal, AI Panel, etc.)
 * Provides a consistent 44x44 circular/square hover area with a centered icon.
 */
const PanelActionButton = ({ icon: Icon, onClick, title, className = "", iconSize = 18, iconWeight = "bold" }) => {
  return (
    <button 
      className={`panel-header-action-btn ${className}`} 
      onClick={onClick} 
      title={title}
      type="button"
    >
      <Icon size={iconSize} weight={iconWeight} />
    </button>
  );
};

export default PanelActionButton;
