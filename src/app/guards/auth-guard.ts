import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { SupabaseService } from '../services/supabase';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  const { data: { session }, error } = await supabaseService.client.auth.getSession();

  if (error) {
    console.error('Auth guard error:', error.message);
  }

  if (session) {
    return true;
  } else {
    return router.parseUrl('/login');
  }
};