import "./globals.css";
import Providers from "./providers";
import AuthButton from "./components/AuthButton";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="border-b">
            <div className="container flex items-center justify-between py-4">
              <a href="/" className="font-bold text-xl">AEOBRO</a>
              <nav className="flex gap-4">
                <a href="/pricing">Pricing</a>
                <a href="/faq">FAQ</a>
                <a className="btn" href="/audit">Audit</a>
                <AuthButton />
              </nav>
            </div>
          </header>

          <main>{children}</main>

          <footer className="border-t mt-16">
            <div className="container py-8 text-sm text-gray-600 flex gap-4">
              <span>© {new Date().getFullYear()} AEOBRO</span>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/aup">AUP</a>
              <a href="/disputes">Disputes</a>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
