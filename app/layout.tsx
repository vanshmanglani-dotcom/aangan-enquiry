export const metadata = { title: "Aangan Enquiry Dashboard" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f7fb", color: "#1b2a4a" }}>{children}</body></html>);
}
