import './globals.css';

export const metadata = {
  title: 'Auto-Job Dashboard',
  description: 'Naukri search + auto-apply control panel',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
