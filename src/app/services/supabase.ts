import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      'https://mzbncwsizcsandcptylq.supabase.co', 
      'sb_publishable_lS4H48WeVoLRzIBpyg5IZQ_3uNthNyy'
    );
  }

  get client(): SupabaseClient {
    
    return this.supabase;
  }

  /**
   * Fetches the is_admin status for the specified user ID
   * from the profiles table.
   */
  async checkIsAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Error fetching admin status:', error);
      return false;
    }
    
    return data.is_admin === true;
  }
}