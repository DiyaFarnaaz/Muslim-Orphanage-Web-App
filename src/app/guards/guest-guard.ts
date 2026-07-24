import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SupabaseService } from '../services/supabase';

export const guestGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Fetch the current session
  const { data: { session }, error } = await supabase.client.auth.getSession();

  if (error) {
    console.error('Guest guard error:', error.message);
    return true;
  }

  // If a session truly exists, redirect to dashboard
  if (session) {
    return router.parseUrl('/dashboard');
  }
  
  // Otherwise, allow access to the guest page (login/register)
  return true;
};