import { Navbar } from '@/app/components/Navbar';
import { acceptWorkspaceInvitation } from '@/app/actions';

export default async function JobsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await acceptWorkspaceInvitation();
  return <main className="shell"><Navbar />{children}</main>;
}
