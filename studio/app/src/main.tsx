import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/tokens.css';
import './theme/base.css';
import { App } from './App';
import { startTheme } from './theme';

const root = document.getElementById('root');
if (!root) throw new Error('The page is missing its root element.');

startTheme();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
