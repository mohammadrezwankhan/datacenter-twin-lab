import { requiredPresent } from './required-value';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(
  requiredPresent(document.getElementById('root'), "document.getElementById('root')"),
).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
