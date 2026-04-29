import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from "@vercel/analytics/react";
import App from './App';

/* Styles — split by feature */
import './styles/index.css';
import './styles/layout.css';
import './styles/sidebar.css';
import './styles/editor.css';
import './styles/tabs.css';
import './styles/terminal.css';
import './styles/components.css';
import './styles/github.css';
import './styles/palette.css';
import './styles/deploy.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>
);