import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  constructor(private supabaseService: SupabaseService) {}

  // Example: Fetch all class groups
  async getClassGroups() {
    return await this.supabaseService.client
      .from('class_groups')
      .select('*');
  }

  // Example: Fetch all sessions
  async getSessions() {
    return await this.supabaseService.client
      .from('sessions')
      .select('*, class_groups(name)');
  }

  // Example: Add a new session
  async addSession(topic: string, classGroupId: number) {
    return await this.supabaseService.client
      .from('sessions')
      .insert([{ topic, class_group_id: classGroupId }]);
  }
}
