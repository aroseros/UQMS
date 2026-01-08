'use client';

import { createClient } from '@/utils/supabase/client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();
    const supabase = createClient();

    const [isSignUp, setIsSignUp] = useState(false);

    const handleAuth = async () => {
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) toast.error(error.message);
            else toast.success('Check your email to confirm signup!');
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) {
                toast.error('Login failed: ' + error.message);
            } else {
                toast.success('Logged in!');
                router.push('/dashboard');
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>{isSignUp ? 'Create Admin Account' : 'Staff Login'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    <Input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    <Button onClick={handleAuth} className="w-full">
                        {isSignUp ? 'Sign Up' : 'Sign In'}
                    </Button>
                    <div className="text-center text-sm">
                        <span
                            className="underline cursor-pointer text-slate-500"
                            onClick={() => setIsSignUp(!isSignUp)}
                        >
                            {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
