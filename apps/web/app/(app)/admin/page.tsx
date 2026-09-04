import { notFound } from 'next/navigation';
import { AdminView } from '@/components/admin/admin-view';
import { serverApi } from '@/lib/api.server';

export default async function AdminPage() {
  const api = serverApi();
  const me = await api.call('me');
  if (me.role !== 'admin') notFound();

  return <AdminView />;
}
