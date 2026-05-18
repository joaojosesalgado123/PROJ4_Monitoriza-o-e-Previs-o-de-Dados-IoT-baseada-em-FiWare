import Header from '../../components/header';
import Sidebar from '../../components/sidebar';
import { MachinesView } from '../../components/charts';

export default function MaquinasPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <Header />

      <main className="ml-64 px-8 pb-10 pt-24">
        <MachinesView />
      </main>
    </div>
  );
}
