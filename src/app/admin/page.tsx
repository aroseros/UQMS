'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// Interfaces
interface Faculty {
    id: string;
    name: string;
}

interface Profile {
    id: string;
    full_name: string | null;
    role: 'admin' | 'agent';
    // Joined data
    agent_assignments?: {
        faculty_id: string;
        faculties?: {
            name: string;
        }
    }[];
}

export default function AdminPage() {
    const supabase = createClient();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [faculties, setFaculties] = useState<Faculty[]>([]);
    const [loading, setLoading] = useState(false);

    // Edit State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        full_name: '',
        role: 'agent' as 'admin' | 'agent',
        faculty_id: 'none'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        // 1. Fetch Faculties
        const { data: facData } = await supabase.from('faculties').select('id, name').order('name');
        setFaculties(facData || []);

        // 2. Fetch Profiles with Assignments
        // Note: We use a somewhat complex query to get linked faculty
        const { data: profData, error } = await supabase
            .from('profiles')
            .select(`
                id, full_name, role,
                agent_assignments (
                    faculty_id,
                    faculties ( name )
                )
            `)
            .order('full_name');

        if (error) {
            console.error(error);
            toast.error('Failed to load staff');
        } else {
            setProfiles(profData as any[] || []);
        }
        setLoading(false);
    };

    const handleEditClick = (profile: Profile) => {
        const currentFaculty = profile.agent_assignments?.[0]?.faculty_id || 'none';
        setEditingId(profile.id);
        setEditForm({
            full_name: profile.full_name || '',
            role: profile.role,
            faculty_id: currentFaculty
        });
    };

    const handleSave = async () => {
        if (!editingId) return;
        setLoading(true);

        try {
            // 1. Update Profile (Name, Role)
            const { error: pError } = await supabase
                .from('profiles')
                .update({
                    full_name: editForm.full_name,
                    role: editForm.role
                })
                .eq('id', editingId);

            if (pError) throw pError;

            // 2. Update Assignment
            if (editForm.faculty_id !== 'none') {
                // Upsert assignment
                const { error: aError } = await supabase
                    .from('agent_assignments')
                    .upsert({
                        user_id: editingId,
                        faculty_id: editForm.faculty_id
                    }, { onConflict: 'user_id, faculty_id' }); // Actually unique constraint is usually (user, faculty). 
                // Verify Constraint: unique(user_id, faculty_id) in schema.
                // Ideally we want 1 assignment per user?
                // The schema permits multiple. But here we treat as 'primary'.
                // If we want to switch, we might need to delete others or just add this one.
                // For now, let's just Insert/Upsert this one.

                if (aError) throw aError;
            } else {
                // Remove all assignments if 'none' selected? 
                // Maybe dangerous. Let's just not add any.
                // Or explicitly delete?
                // await supabase.from('agent_assignments').delete().eq('user_id', editingId);
            }

            toast.success('Staff updated');
            setEditingId(null);
            loadData(); // Reload table
        } catch (e: any) {
            toast.error('Update failed: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
                        <p className="text-slate-500">Manage staff, roles, and assignments</p>
                    </div>
                    <Button onClick={loadData} variant="outline" disabled={loading}>
                        Refresh Data
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Staff Directory ({profiles.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-600 uppercase font-medium">
                                    <tr>
                                        <th className="px-4 py-3 rounded-tl-lg">Staff Name</th>
                                        <th className="px-4 py-3">Role</th>
                                        <th className="px-4 py-3">Assigned Faculty</th>
                                        <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {profiles.map((profile) => {
                                        const assignment = profile.agent_assignments?.[0];
                                        const facultyName = assignment?.faculties?.name || 'Unassigned';

                                        return (
                                            <tr key={profile.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-900">
                                                    {profile.full_name || 'Unknown'}
                                                    <div className="text-xs text-slate-400 font-normal font-mono">{profile.id.slice(0, 8)}...</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`
                                                        px-2 py-1 rounded-full text-xs font-semibold
                                                        ${profile.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}
                                                    `}>
                                                        {profile.role.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    {facultyName}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleEditClick(profile)}
                                                    >
                                                        Edit
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Edit Modal Overlay */}
                {editingId && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <Card className="w-full max-w-md animate-in fade-in zoom-in duration-200">
                            <CardHeader>
                                <CardTitle>Edit Staff Member</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">

                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input
                                        value={editForm.full_name}
                                        onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select
                                        value={editForm.role}
                                        onValueChange={(val: 'admin' | 'agent') => setEditForm({ ...editForm, role: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="agent">Agent</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Primary Assignment</Label>
                                    <Select
                                        value={editForm.faculty_id}
                                        onValueChange={(val) => setEditForm({ ...editForm, faculty_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">-- No Assignment --</SelectItem>
                                            {faculties.map(f => (
                                                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-slate-400">
                                        Assigning a new faculty will add/update the user's assignment.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                                    <Button onClick={handleSave} disabled={loading}>
                                        {loading ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>

                            </CardContent>
                        </Card>
                    </div>
                )}

            </div>
        </div>
    );
}
