import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase'; // Matches your filename supabase.ts

@Injectable({
  providedIn: 'root'
})
export class DataService {
  constructor(private supabaseService: SupabaseService) {}

  // Fetch all class groups
  async getClassGroups() {
    return await this.supabaseService.client
      .from('class_groups')
      .select('*');
  }

  // Fetch all sessions with related class group name
  async getSessions() {
    return await this.supabaseService.client
      .from('sessions')
      .select('*, class_groups(name)');
  }

  // Add a new session
  async addSession(topic: string, classGroupId: number) {
    return await this.supabaseService.client
      .from('sessions')
      .insert([{ topic, class_group_id: classGroupId }]);
  }
}