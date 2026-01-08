import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Define the Ticket interface
export interface Ticket {
    id: string;
    ticket_number: string;
    faculty_id: string;
    status: 'waiting' | 'serving' | 'completed' | 'cancelled';
    created_at: string;
    served_by?: string;
    metadata?: Record<string, any>;
}

interface UseSupabaseQueueProps {
    facultyId?: string; // Optional: if provided, filters by faculty
    statusFilter?: Ticket['status']; // Optional: filter by status (e.g., 'serving' for TV display)
}

/**
 * Modular Hook for Real-Time Queue Updates
 * 
 * Supports:
 * - Dynamic filtering (by faculty or status)
 * - Auto-subscription management (unsubscribes on unmount)
 * - Type-safe Supabase events
 */
export function useSupabaseQueue({ facultyId, statusFilter }: UseSupabaseQueueProps = {}) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const supabase = createClient();

    useEffect(() => {
        // Initial Fetch
        const fetchInitialData = async () => {
            let query = supabase
                .from('tickets')
                .select('*')
                .order('created_at', { ascending: true });

            if (facultyId) {
                query = query.eq('faculty_id', facultyId);
            }
            if (statusFilter) {
                query = query.eq('status', statusFilter);
            }

            const { data, error } = await query;
            if (error) console.error('Error fetching tickets:', error);
            else setTickets(data as Ticket[]);
        };

        fetchInitialData();

        // Real-Time Subscription
        const channelName = `public:tickets:${facultyId || 'all'}:${statusFilter || 'all'}`;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'tickets',
                    // Note: Supabase Realtime filters are limited. simpler to filter client-side 
                    // or use precise filters if column values are static. 
                    // For dynamic complexity, we receive all and filter in callback.
                    filter: facultyId ? `faculty_id=eq.${facultyId}` : undefined,
                },
                (payload: RealtimePostgresChangesPayload<Ticket>) => {
                    handleRealtimeEvent(payload);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [facultyId, statusFilter, supabase]);

    const handleRealtimeEvent = (payload: RealtimePostgresChangesPayload<Ticket>) => {
        // Handle INSERT
        if (payload.eventType === 'INSERT') {
            const newTicket = payload.new;
            if (statusFilter && newTicket.status !== statusFilter) return; // Skip if status doesn't match
            setTickets((prev) => [...prev, newTicket]);
        }

        // Handle UPDATE
        if (payload.eventType === 'UPDATE') {
            const updatedTicket = payload.new;
            setTickets((prev) => {
                // If status changed and no longer matches filter, remove it
                if (statusFilter && updatedTicket.status !== statusFilter) {
                    return prev.filter((t) => t.id !== updatedTicket.id);
                }
                // Update existing item
                return prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t));
            });
        }

        // Handle DELETE
        if (payload.eventType === 'DELETE') {
            setTickets((prev) => prev.filter((t) => t.id !== payload.old.id));
        }
    };

    return { tickets };
}
