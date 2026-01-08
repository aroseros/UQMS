import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full space-y-8 text-center">
        <h1 className="text-4xl font-bold text-slate-900 tracking-tight">University Queue Management System</h1>
        <p className="text-lg text-slate-500">Select an interface to proceed:</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          <Link href="/kiosk" className="group">
            <Card className="h-full hover:border-blue-500 transition-all hover:shadow-lg cursor-pointer">
              <CardContent className="p-6 flex flex-col items-center gap-4">
                <div className="text-6xl group-hover:scale-110 transition-transform">🎫</div>
                <div className="font-bold text-xl">Student Kiosk</div>
                <div className="text-sm text-slate-400">For getting tickets</div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/display" className="group">
            <Card className="h-full hover:border-emerald-500 transition-all hover:shadow-lg cursor-pointer">
              <CardContent className="p-6 flex flex-col items-center gap-4">
                <div className="text-6xl group-hover:scale-110 transition-transform">📺</div>
                <div className="font-bold text-xl">TV Display</div>
                <div className="text-sm text-slate-400">Public waiting screen</div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/login" className="group">
            <Card className="h-full hover:border-indigo-500 transition-all hover:shadow-lg cursor-pointer">
              <CardContent className="p-6 flex flex-col items-center gap-4">
                <div className="text-6xl group-hover:scale-110 transition-transform">🛡️</div>
                <div className="font-bold text-xl">Staff Agent</div>
                <div className="text-sm text-slate-400">Login to Dashboard</div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin" className="group">
            <Card className="h-full hover:border-orange-500 transition-all hover:shadow-lg cursor-pointer">
              <CardContent className="p-6 flex flex-col items-center gap-4">
                <div className="text-6xl group-hover:scale-110 transition-transform">⚙️</div>
                <div className="font-bold text-xl">Admin Panel</div>
                <div className="text-sm text-slate-400">System config</div>
              </CardContent>
            </Card>
          </Link>

        </div>
      </div>
    </div>
  );
}
