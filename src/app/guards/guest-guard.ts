import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SupabaseService } from '../services/supabase';

export const guestGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data: { session } } = await supabase.client.auth.getSession();

  if (session) {
    return router.parseUrl('/dashboard');
  }
  
  return true;
};