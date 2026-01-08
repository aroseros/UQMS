'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

    useEffect(() => {
        loadFaculties();
    }, []);

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

        // Call Hardware Bridge with Timeout
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

            await fetch('http://localhost:8080/print', {
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
            // toast.warning('Ticket created! (Printer offline)'); // Optional: don't scare user
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center">

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
