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
      'sb_publishable_lS4H48WeVoLRzIBpyg5IZQ_3uNthNyy',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        global: {
          headers: {
            'Accept': 'application/json',
          },
        },
      }
    );
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Fetches the is_admin status for the specified user ID
   * from the profiles table using maybeSingle to prevent 406/single errors.
   */
  async checkIsAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching admin status:', error);
      return false;
    }
    
    return data.is_admin === true;
  }

  // --- Auth Helper ---
  async getCurrentUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error) throw error;
    return user;
  }

  // --- Weekly Tasks Operations ---

  // Fetch all weekly tasks sorted by latest first
  async getWeeklyTasks() {
    const { data, error } = await this.supabase
      .from('weekly_tasks')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Create a new weekly task plan
  async createWeeklyTask(task: any) {
    const { error } = await this.supabase
      .from('weekly_tasks')
      .insert([task]);

    if (error) throw error;
  }

  // Update an existing weekly task plan by ID
  async updateWeeklyTask(id: number, task: any) {
    const { error } = await this.supabase
      .from('weekly_tasks')
      .update(task)
      .eq('id', id);

    if (error) throw error;
  }
}