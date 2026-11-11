import Link from 'next/link';
export default function NotFound(){return <section className="panel empty"><h1>Page not found</h1><p>This unit or page is not in the current report.</p><Link href="/units">Browse units →</Link></section>;}
