import { Fira_Code, Fira_Sans } from 'next/font/google';
import './globals.css';
import AppShell from './components/AppShell';

const firaSans = Fira_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-fira-sans', display: 'swap' });
const firaCode = Fira_Code({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-fira-code', display: 'swap' });

export const metadata = {
  title: 'Job Pilot',
  description: 'Naukri search + auto-apply control panel',
};

// Runs before first paint so a saved dark theme never flashes light.
const themeScript = `(function(){try{var c=localStorage.getItem('theme')||'system';var d=c==='dark'||(c==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${firaSans.variable} ${firaCode.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
