import { notFound } from 'next/navigation';
import { UnitDetail } from '@/components/units';
import { getProgress } from '@/lib/progress';
export async function generateMetadata({params}:{params:Promise<{slug:string[]}>}) { return {title:(await params).slug.join('/')}; }
export default async function Page({params}:{params:Promise<{slug:string[]}>}) {
  const name=(await params).slug.join('/');
  const {data}=await getProgress();
  if(!data.latest.units.some(u=>u.name===name))notFound();
  return <UnitDetail name={name} />;
}
