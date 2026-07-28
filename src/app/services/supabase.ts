import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;
  
  // Brevo Configuration Constants
  private readonly BREVO_API_KEY = 'xkeysib-your-actual-brevo-api-key-here'; 
  private readonly BREVO_TEMPLATE_ID = 1; // Replace with your template ID

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

  // --- Brevo Email Helper ---
  async sendApprovalEmail(userEmail: string, userName: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.BREVO_API_KEY
        },
        body: JSON.stringify({
          to: [{ email: userEmail, name: userName || 'Volunteer' }],
          templateId: this.BREVO_TEMPLATE_ID,
          params: {
            name: userName || 'Volunteer'
          }
        })
      });

      return response.ok;
    } catch (err) {
      console.error('Error triggering Brevo email API:', err);
      return false;
    }
  }

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

  async getCurrentUser() {
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error) throw error;
    return user;
  }

  async getWeeklyTasks() {
    const { data, error } = await this.supabase
      .from('weekly_tasks')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createWeeklyTask(task: any) {
    const { error } = await this.supabase
      .from('weekly_tasks')
      .insert([task]);

    if (error) throw error;
  }

  async updateWeeklyTask(id: number, task: any) {
    const { error } = await this.supabase
      .from('weekly_tasks')
      .update(task)
      .eq('id', id);

    if (error) throw error;
  }
}