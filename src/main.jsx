import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/* Styles — split by feature */
import './styles/index.css';
import './styles/layout.css';
import './styles/sidebar.css';
import './styles/editor.css';
import './styles/tabs.css';
import './styles/terminal.css';
import './styles/components.css';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);