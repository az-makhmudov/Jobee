import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { ThemeProvider } from './ui/Theme.js';
import { FeedbackProvider } from './ui/Feedback.js';
import './index.css';
import './styles.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ThemeProvider>
        <FeedbackProvider>
          <App />
        </FeedbackProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
}
