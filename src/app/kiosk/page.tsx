'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Interfaces
interface Faculty {
    id: string;
    name: string;
    code: string;
}

interface Department {
    id: string;
    faculty_id: string;
    prefix: string;
}

export default function KioskPage() {
    const supabase = createClient();
    const [faculties, setFaculties] = useState<Faculty[]>([]);
    const [loading, setLoading] = useState(false);
    const [printerUrl, setPrinterUrl] = useState('http://localhost:8080');
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        loadFaculties();
        const savedUrl = localStorage.getItem('printer_url');
        if (savedUrl) setPrinterUrl(savedUrl);
    }, []);

    const saveSettings = () => {
        localStorage.setItem('printer_url', printerUrl);
        setShowSettings(false);
        toast.success('Printer URL saved');
    };

    const loadFaculties = async () => {
        const { data, error } = await supabase
            .from('faculties')
            .select('*')
            .order('name');

        if (error) {
            toast.error('Failed to load faculties');
            console.error(error);
        } else {
            setFaculties(data || []);
        }
    };

    const handleFacultyClick = async (faculty: Faculty) => {
        setLoading(true);
        try {
            // 1. Find the first department for this faculty
            const { data: depts, error: deptError } = await supabase
                .from('departments')
                .select('id, prefix')
                .eq('faculty_id', faculty.id)
                .limit(1);

            if (deptError || !depts || depts.length === 0) {
                toast.error(`No departments found for ${faculty.name}`);
                setLoading(false);
                return;
            }

            const targetDept = depts[0];
            await createTicket(targetDept.id, targetDept.prefix);

        } catch (error) {
            console.error(error);
            toast.error('Something went wrong');
            setLoading(false);
        }
    };

    const createTicket = async (departmentId: string, prefix: string) => {
        // Generate Ticket Number (Local random for demo, ideally DB sequence)
        const randomNum = Math.floor(100 + Math.random() * 900);
        const ticketNumber = `${prefix}-${randomNum}`;
        const timestamp = new Date().toLocaleString();

        // Insert Ticket
        const { data, error } = await supabase
            .from('tickets')
            .insert({
                department_id: departmentId,
                ticket_number: ticketNumber,
                status: 'waiting',
                metadata: { source: 'kiosk_touch' }
            });

        if (error) {
            toast.error('Failed to get ticket: ' + error.message);
            setLoading(false);
            return;
        }

        // Success - Print
        toast.success(`Ticket ${ticketNumber} Printed!`);

        // 📱 MOBILE APP BRIDGE
        // If running inside our Android App, send data to Native Layer
        // @ts-ignore
        if (window.ReactNativeWebView) {
            // @ts-ignore
            window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'print_ticket',
                payload: {
                    ticket_number: ticketNumber,
                    date: timestamp,
                    department: departmentId // Simple ID for now
                }
            }));
            setLoading(false);
            return; // Skip the fetch/network print if native
        }

        // Call Hardware Bridge with Timeout (Legacy/Desktop Mode)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

            // Use the Helper URL
            await fetch(`${printerUrl}/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_number: ticketNumber,
                    date: new Date().toLocaleString()
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
        } catch (e) {
            console.warn('Printer bridge not reachable or timed out');
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center relative">

            {/* Hidden Settings Trigger (Bottom Right) */}
            <div
                className="absolute bottom-4 right-4 w-8 h-8 opacity-10 cursor-pointer"
                onClick={() => setShowSettings(true)}
            >
                ⚙️
            </div>

            {/* Settings Dialog */}
            {showSettings && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Card className="w-96">
                        <CardHeader>
                            <CardTitle>Kiosk Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Printer Bridge URL</label>
                                <input
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={printerUrl}
                                    onChange={(e) => setPrinterUrl(e.target.value)}
                                />
                                <p className="text-xs text-slate-500">
                                    Format: https://xxxx.ngrok-free.app (No trailing slash)
                                </p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
                                <Button onClick={saveSettings}>Save</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="max-w-5xl w-full space-y-8">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl font-bold tracking-tight text-slate-900">Welcome</h1>
                    <p className="text-xl text-slate-500">Please tap your faculty to get a ticket</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {faculties.map((faculty) => (
                        <Card
                            key={faculty.id}
                            onClick={() => !loading && handleFacultyClick(faculty)}
                            className={`
                                cursor-pointer hover:shadow-xl transition-all hover:scale-105 active:scale-95 border-2
                                ${loading ? 'opacity-50 pointer-events-none' : 'hover:border-blue-500'}
                            `}
                        >
                            <CardContent className="p-10 flex flex-col items-center text-center space-y-4">
                                {/* Placeholder Icon */}
                                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-2">
                                    <span className="text-3xl font-bold">{faculty.code.slice(0, 1)}</span>
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800">{faculty.name}</h3>
                                <p className="text-sm text-slate-400 uppercase tracking-widest font-semibold">{faculty.code}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {loading && (
                    <div className="text-center text-blue-600 animate-pulse text-xl font-medium">
                        Printing your ticket...
                    </div>
                )}
            </div>
        </div>
    );
}
