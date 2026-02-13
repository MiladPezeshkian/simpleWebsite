import { createRoot } from 'react-dom/client';
import '@/i18n';
import App from './App.tsx';
import './index.css';

const lang = localStorage.getItem('lang') || 'en';
document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';

createRoot(document.getElementById("root")!).render(<App />);
