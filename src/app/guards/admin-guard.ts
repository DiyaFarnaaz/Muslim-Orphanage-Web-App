import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SupabaseService } from '../services/supabase';

export const adminGuard: CanActivateFn = async (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  // 1. Check if user has an active session
  const { data: { session }, error } = await supabaseService.client.auth.getSession();

  if (error || !session) {
    alert('Please log in first.');
    return router.parseUrl('/login');
  }

  // 2. Check if the user is an admin in the profiles table
  const { data: profile, error: profileError } = await supabaseService.client
    .from('profiles')
    .select('is_admin, role')
    .eq('id', session.user.id)
    .single();

  if (profileError || (!profile?.is_admin && profile?.role !== 'admin')) {
    alert('Access denied: Admins only.');
    return router.parseUrl('/dashboard'); // Kick non-admins back to dashboard or meetings
  }

  return true; // Allow access if they are an admin
};