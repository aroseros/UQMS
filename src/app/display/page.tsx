'use client';

import { useEffect, useState, useRef } from 'react';
import { useSupabaseQueue, Ticket } from '@/hooks/useSupabaseQueue';
import { Card, CardContent } from '@/components/ui/card';

export default function DisplayPage() {
    // Subscribe to 'serving' tickets
    const { tickets } = useSupabaseQueue({ statusFilter: 'serving' });
    const [lastTicketId, setLastTicketId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Play sound when new ticket appears
    useEffect(() => {
        // Find the newest serving ticket
        // Assuming tickets are ordered by creation or update? 
        // The hook returns by created_at asc. 
        // We want to detect if a NEW ticket entered the list.

        // Simple logic: if tickets length > 0 and the last one is different from stored, play sound.
        // Or if tickets changed.

        if (tickets.length > 0) {
            // Get the latest one (most recently updated? The hook sort might be static on created_at)
            // RealWorld: should probably sort by 'metadata.called_at' desc
            // For now, let's just pick the last one in the list or assume single department display?
            // If global display, we show multiple.

            const latest = tickets[tickets.length - 1]; // Naive latest
            if (latest.id !== lastTicketId) {
                setLastTicketId(latest.id);
                // Play Chime
                if (audioRef.current) {
                    audioRef.current.play().catch(e => console.log('Audio autoplay blocked', e));
                }
            }
        }
    }, [tickets, lastTicketId]);

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center justify-center">
            <audio ref={audioRef} src="/chime.mp3" />

            <h1 className="text-4xl font-light tracking-widest uppercase mb-12">Now Serving</h1>

            {tickets.length === 0 ? (
                <div className="text-2xl text-slate-500 animate-pulse">
                    Waiting for next number...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-6xl">
                    {tickets.map((ticket) => (
                        <Card key={ticket.id} className="bg-slate-800 border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
                            <CardContent className="p-12 text-center">
                                <div className="text-8xl font-black text-emerald-400 mb-4 tracking-tighter">
                                    {ticket.ticket_number}
                                </div>
                                <div className="text-xl text-slate-400 uppercase tracking-widest">
                                    Process at Counter
                                </div>
                                {ticket.served_by && (
                                    <div className="mt-4 text-sm text-slate-600">
                                        Agent ID: {ticket.served_by.slice(0, 4)}...
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
