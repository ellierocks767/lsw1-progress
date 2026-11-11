import type { Metadata } from 'next';
import Link from 'next/link';
import { FeedProvider } from '@/components/feed';
import { Navigation, Freshness } from '@/components/shell';
import { getProgress } from '@/lib/progress';
import './globals.css';
export const metadata: Metadata = { title: { default: 'LSW1 progress', template: '%s · LSW1 progress' }, description: 'Matching progress for LEGO Star Wars: The Video Game on GameCube.' };
export const dynamic = 'force-dynamic';
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const feed = await getProgress();
  return <html lang="en"><body><FeedProvider initial={feed}><header className="site-header"><Link className="brand" href="/">LSW1<span>decompilation</span></Link><Navigation /><a className="repo-link" href="https://github.com/ellierocks767/lsw1-decomp">Source ↗</a></header><main><Freshness />{children}</main><footer>LEGO Star Wars: The Video Game · GameCube GL5E4F · an independent decompilation project</footer></FeedProvider></body></html>;
}
