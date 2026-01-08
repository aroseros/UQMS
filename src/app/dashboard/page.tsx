'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useSupabaseQueue, Ticket } from '@/hooks/useSupabaseQueue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

export default function DashboardPage() {
    const supabase = createClient();
    const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
    const [currentTicket, setCurrentTicket] = useState<Ticket | null>(null);

    // Custom Hook for Real-time Queue
    const { tickets } = useSupabaseQueue({
        departmentId: departmentId,
        statusFilter: 'waiting'
    });

    // Load Agent's Assignment
    useEffect(() => {
        const loadAssignment = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                // Redirect to login (omitted for brevity)
                return;
            }

            const { data, error } = await supabase
                .from('agent_assignments')
                .select('department_id')
                .eq('user_id', user.id)
                .single();

            if (error) {
                toast.error('Could not find your department assignment');
            } else {
                setDepartmentId(data.department_id);
            }
        };
        loadAssignment();
    }, [supabase]);

    // Call Next Ticket
    const callNext = async () => {
        if (!departmentId) return;

        try {
            const { data, error } = await supabase
                .rpc('call_next_ticket', { p_department_id: departmentId });

            if (error) throw error;
            if (!data) {
                toast.info('No tickets waiting');
                return;
            }

            setCurrentTicket(data as Ticket);
            toast.success(`Calling Ticket: ${data.ticket_number}`);
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    const completeTicket = async () => {
        if (!currentTicket) return;
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ status: 'completed' })
                .eq('id', currentTicket.id);

            if (error) throw error;
            setCurrentTicket(null);
            toast.success('Ticket completed');
        } catch (err: any) {
            toast.error(err.message);
        }
    };

    if (!departmentId) {
        return <div className="p-8 text-center">Loading assignment... (Ensure you are logged in)</div>;
    }

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Staff Dashboard</h1>
                <div className="text-slate-500">Dept ID: {departmentId.slice(0, 8)}...</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Current Serving */}
                <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                        <CardTitle>Now Serving</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {currentTicket ? (
                            <div className="text-center">
                                <div className="text-5xl font-extrabold text-blue-600 mb-2">
                                    {currentTicket.ticket_number}
                                </div>
                                <div className="text-sm text-slate-500 mb-6">
                                    Started at {new Date(currentTicket.metadata?.called_at || Date.now()).toLocaleTimeString()}
                                </div>
                                <Button onClick={completeTicket} className="w-full" variant="outline">
                                    Mark Completed
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                No active ticket
                            </div>
                        )}

                        <Button onClick={callNext} className="w-full h-16 text-xl" disabled={!!currentTicket}>
                            {currentTicket ? 'Finish Current First' : 'Call Next Ticket'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Waiting Queue */}
                <Card>
                    <CardHeader>
                        <CardTitle>Waiting Queue ({tickets.length})</CardTitle>
                        <CardDescription>Real-time updates</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {tickets.length === 0 && <p className="text-slate-400 italic">Queue is empty</p>}
                            {tickets.map((ticket) => (
                                <div key={ticket.id} className="p-3 bg-white border rounded shadow-sm flex justify-between items-center">
                                    <span className="font-bold text-lg">{ticket.ticket_number}</span>
                                    <span className="text-xs text-slate-400">
                                        {new Date(ticket.created_at).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
