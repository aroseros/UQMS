'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { User } from '@supabase/supabase-js';

interface Profile {
    id: string;
    full_name: string | null;
    role: 'admin' | 'agent';
}

interface Department {
    id: string;
    name: string;
}

export default function AdminPage() {
    const supabase = createClient();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [selectedProfile, setSelectedProfile] = useState<string>('');
    const [selectedDept, setSelectedDept] = useState<string>('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        // 1. Fetch Profiles
        const { data: profilesData, error: pError } = await supabase
            .from('profiles')
            .select('id, full_name, role');

        if (pError) console.error('Error loading profiles:', pError);
        else setProfiles(profilesData || []);

        // 2. Fetch Departments
        const { data: deptData, error: dError } = await supabase
            .from('departments')
            .select('id, name');

        if (dError) console.error('Error loading departments:', dError);
        else setDepartments(deptData || []);
    };

    const handleAssign = async () => {
        if (!selectedProfile || !selectedDept) return;
        setLoading(true);

        try {
            const { error } = await supabase
                .from('agent_assignments')
                .upsert({
                    user_id: selectedProfile,
                    department_id: selectedDept
                }, { onConflict: 'user_id, department_id' });

            if (error) throw error;
            toast.success('Assignment updated');
        } catch (err: any) {
            toast.error('Failed to assign: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold">Admin Panel</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Assign Agent to Department</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* Profile Select */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Agent</label>
                            <Select onValueChange={setSelectedProfile} value={selectedProfile}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Agent" />
                                </SelectTrigger>
                                <SelectContent>
                                    {profiles.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.full_name || p.id.slice(0, 8)} ({p.role})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Department Select */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Department</label>
                            <Select onValueChange={setSelectedDept} value={selectedDept}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map(d => (
                                        <SelectItem key={d.id} value={d.id}>
                                            {d.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                    </div>

                    <Button onClick={handleAssign} disabled={loading || !selectedProfile || !selectedDept}>
                        {loading ? 'Assigning...' : 'Assign Department'}
                    </Button>

                </CardContent>
            </Card>

            {/* Tip for creating users */}
            <div className="bg-yellow-50 p-4 rounded text-sm text-yellow-800 border-l-4 border-yellow-400">
                <strong>Note:</strong> To create new users, please use the Supabase Dashboard's Authentication tab.
                Once created, they will appear in the list above (managed by the `public.profiles` table trigger or manual insertion).
            </div>
        </div>
    );
}
