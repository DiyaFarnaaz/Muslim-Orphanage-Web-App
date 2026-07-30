import { Injectable, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase';

declare var JitsiMeetExternalAPI: any;

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
      window: Window | null;
    };
  }
}

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
}

export interface Participant {
  id: string;
  displayName: string;
}

export type OverlayMode = 'hidden' | 'full' | 'floating' | 'external';

/**
 * Single source of truth for the active call.
 *
 * Design goal: this service does NOT build any UI. It only holds state
 * (Angular Signals) and drives the Jitsi API. The one DOM element it does
 * touch is the raw <div> that Jitsi itself needs as a mount target
 * (`jitsiContainer`), and only for two reasons:
 *   1) telling Jitsi where to render its iframe on join()
 *   2) optionally reparenting that single div into a real browser
 *      Picture-in-Picture window, which is unavoidable - Jitsi's iframe
 *      can't "teleport" any other way.
 *
 * Everything else - toolbar, chat, participants list, floating widget
 * chrome - is plain Angular template driven by these signals.
 */
@Injectable({ providedIn: 'root' })
export class MeetingService {
  private api: any = null;
  private jitsiContainer: HTMLElement | null = null;
  private hostElement: HTMLElement | null = null;
  private pipWindow: Window | null = null;
  private localDisplayName = '';

  private pendingJoin: {
    roomName: string; email: string; name: string; meetingId: string; isAdmin: boolean;
  } | null = null;

  // ---- state ----------------------------------------------------------
  readonly activeMeetingId = signal<string | null>(null);
  readonly roomName = signal<string | null>(null);
  readonly mode = signal<OverlayMode>('hidden');
  readonly isAdmin = signal(false);

  readonly isAudioMuted = signal(false);
  readonly isVideoMuted = signal(false);
  readonly isChatOpen = signal(false);
  readonly chatMessages = signal<ChatMessage[]>([]);
  readonly participants = signal<Participant[]>([]);
  readonly unreadCount = signal(0);

  readonly isActive = computed(() => this.mode() !== 'hidden');
  readonly isMinimized = computed(() => this.mode() === 'floating' || this.mode() === 'external');

  constructor(private supabaseService: SupabaseService) {
    window.addEventListener('beforeunload', (e) => {
      if (this.api && this.activeMeetingId()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  // ---- host registration ----------------------------------------------

  /**
   * Called once by MeetingOverlayComponent, which is mounted at the app
   * root (a sibling of <router-outlet>, never destroyed). This gives the
   * service a permanent place to render Jitsi into, so unlike the old
   * implementation, "full screen" vs "floating" is now just CSS on a node
   * that already exists - no reparenting across documents required.
   */
  registerHost(jitsiContainer: HTMLElement, hostElement: HTMLElement): void {
    this.jitsiContainer = jitsiContainer;
    this.hostElement = hostElement;
    if (this.pendingJoin) {
      const p = this.pendingJoin;
      this.pendingJoin = null;
      this.join(p.roomName, p.email, p.name, p.meetingId, p.isAdmin);
    }
  }

  // ---- lifecycle --------------------------------------------------------

  join(roomName: string, userEmail: string, userName: string, meetingId: string, isAdmin: boolean): void {
    if (!this.jitsiContainer) {
      // MeetingOverlay hasn't run ngAfterViewInit yet - queue it.
      this.pendingJoin = { roomName, email: userEmail, name: userName, meetingId, isAdmin };
      return;
    }

    if (this.api && this.roomName() === roomName) {
      this.activeMeetingId.set(meetingId);
      this.isAdmin.set(isAdmin);
      this.expand();
      return;
    }

    if (this.api) {
      this.teardownApi();
    }

    this.localDisplayName = userName || userEmail.split('@')[0];
    this.activeMeetingId.set(meetingId);
    this.roomName.set(roomName);
    this.isAdmin.set(isAdmin);
    this.chatMessages.set([]);
    this.participants.set([]);
    this.unreadCount.set(0);

    const domain = 'meet.jit.si';
    const options = {
      roomName,
      width: '100%',
      height: '100%',
      parentNode: this.jitsiContainer,
      userInfo: { email: userEmail, displayName: this.localDisplayName },
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        prejoinPageEnabled: false,
        disableModeratorIndicator: true,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
          'favourite', 'raisehand', 'videoquality', 'tileview', 'settings', 'stats', 'hangup'
        ]
      }
    };

    this.api = new JitsiMeetExternalAPI(domain, options);
    this.bindApiEvents();
    this.expand();

    // Only needed to survive a hard page reload - normal in-app navigation
    // never destroys this service, so nothing reads this during a session.
    sessionStorage.setItem('active_meeting_id', meetingId);
  }

  private bindApiEvents(): void {
    if (!this.api) return;

    this.api.addEventListener('audioMuteStatusChanged', (d: any) => this.isAudioMuted.set(!!d?.muted));
    this.api.addEventListener('videoMuteStatusChanged', (d: any) => this.isVideoMuted.set(!!d?.muted));
    this.api.addEventListener('readyToClose', () => this.leaveCall());

    this.api.addEventListener('participantJoined', (d: any) => {
      this.participants.update(list => [...list, { id: d.id, displayName: d.displayName || 'Participant' }]);
    });
    this.api.addEventListener('participantLeft', (d: any) => {
      this.participants.update(list => list.filter(p => p.id !== d.id));
    });
    this.api.addEventListener('displayNameChange', (d: any) => {
      this.participants.update(list =>
        list.map(p => (p.id === d.id ? { ...p, displayName: d.displayname || p.displayName } : p))
      );
    });

    this.api.addEventListener('incomingMessage', (d: any) => {
      const msg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        from: d?.nick || d?.from || 'Participant',
        text: d?.message || '',
        timestamp: Date.now(),
        isLocal: false
      };
      this.chatMessages.update(list => [...list, msg]);
      if (!this.isChatOpen()) this.unreadCount.update(n => n + 1);
    });
  }

  sendChatMessage(text: string): void {
    const trimmed = text.trim();
    if (!this.api || !trimmed) return;
    this.api.executeCommand('sendChatMessage', trimmed);
    this.chatMessages.update(list => [...list, {
      id: Math.random().toString(36).slice(2),
      from: 'You',
      text: trimmed,
      timestamp: Date.now(),
      isLocal: true
    }]);
  }

  toggleAudio(): void { this.api?.executeCommand?.('toggleAudio'); }
  toggleVideo(): void { this.api?.executeCommand?.('toggleVideo'); }

  toggleChat(): void {
    this.isChatOpen.update(v => !v);
    if (this.isChatOpen()) this.unreadCount.set(0);
  }

  // ---- view modes ---------------------------------------------------

  expand(): void {
    this.closeExternalPip();
    this.reattachToHost();
    this.mode.set('full');
  }

  minimize(): void {
    if (!this.api) return;
    this.mode.set('floating');
  }

  /** Tries the real OS-level Picture-in-Picture window; falls back to the
   *  in-page floating widget if unsupported or the user gesture requirement
   *  fails (e.g. Safari/Firefox, or if it's called outside a direct click). */
  async requestExternalPiP(): Promise<void> {
    if (!this.jitsiContainer || !window.documentPictureInPicture) {
      this.minimize();
      return;
    }
    try {
      const pipWin = await window.documentPictureInPicture.requestWindow({ width: 360, height: 240 });
      this.pipWindow = pipWin;
      pipWin.document.title = 'Meeting';
      pipWin.document.body.style.margin = '0';
      pipWin.document.body.style.background = '#202124';
      pipWin.document.body.appendChild(this.jitsiContainer);
      pipWin.document.body.addEventListener('dblclick', () => this.expand());
      pipWin.addEventListener('pagehide', () => {
        this.pipWindow = null;
        if (this.api) this.expand();
      }, { once: true });
      this.mode.set('external');
    } catch (err) {
      console.warn('Document PiP unavailable, falling back to in-page floating widget.', err);
      this.pipWindow = null;
      this.minimize();
    }
  }

  private closeExternalPip(): void {
    if (this.pipWindow) {
      try { this.pipWindow.close(); } catch { /* already closed */ }
      this.pipWindow = null;
    }
  }

  private reattachToHost(): void {
    if (this.jitsiContainer && this.hostElement && this.jitsiContainer.parentElement !== this.hostElement) {
      this.hostElement.appendChild(this.jitsiContainer);
    }
  }

  // ---- ending the call --------------------------------------------------

  /** Ordinary participant leaving - records attendance, does NOT flip the
   *  meeting inactive (other people may still be on the call). */
  async leaveCall(): Promise<void> {
    this.api?.executeCommand?.('hangup');
    await this.recordAttendance();
    this.teardown();
  }

  /** Admin ending the meeting for everyone. */
  async endForAll(): Promise<void> {
    this.api?.executeCommand?.('endConference');
    await this.recordAttendance();
    await this.markInactive();
    this.teardown();
  }

  private async recordAttendance(): Promise<void> {
    const meetingId = this.activeMeetingId();
    if (!meetingId) return;
    try {
      const client = this.supabaseService.client;
      if (!client) return;
      const { data } = await client.from('video_meetings').select('past_attendees').eq('id', meetingId).single();
      const existing: string[] = (data?.past_attendees || []) as string[];
      const name = this.localDisplayName || 'Participant';
      const updated = Array.from(new Set([...existing, name]));
      await client.from('video_meetings').update({ past_attendees: updated, updated_at: new Date() }).eq('id', meetingId);
    } catch (err) {
      console.warn('[MeetingService] attendance record failed', err);
    }
  }

  private async markInactive(): Promise<void> {
    const meetingId = this.activeMeetingId();
    if (!meetingId) return;
    try {
      const client = this.supabaseService.client;
      if (client) {
        await client.from('video_meetings').update({ is_active: false, updated_at: new Date() }).eq('id', meetingId);
      }
    } catch (err) {
      console.warn('[MeetingService] marking inactive failed', err);
    }
  }

  private teardownApi(): void {
    this.closeExternalPip();
    if (this.api) {
      try { this.api.dispose(); } catch { /* ignore */ }
      this.api = null;
    }
  }

  private teardown(): void {
    this.teardownApi();
    this.reattachToHost();
    this.activeMeetingId.set(null);
    this.roomName.set(null);
    this.mode.set('hidden');
    this.isAdmin.set(false);
    this.isAudioMuted.set(false);
    this.isVideoMuted.set(false);
    this.isChatOpen.set(false);
    this.chatMessages.set([]);
    this.participants.set([]);
    this.unreadCount.set(0);
    sessionStorage.removeItem('active_meeting_id');
  }

  // ---- reload restore ---------------------------------------------------

  /**
   * Call once from AppComponent.ngOnInit(). Handles the one case
   * navigation alone can't: a hard page reload/deep link while a call was
   * live. Everything else (switching pages within the app) already keeps
   * the call alive automatically because this service - and MeetingOverlay,
   * which mounts it - live at the app root and are never destroyed.
   */
  async restoreIfAny(): Promise<void> {
    const savedId = sessionStorage.getItem('active_meeting_id');
    if (!savedId) return;

    const client = this.supabaseService.client;
    if (!client) {
      sessionStorage.removeItem('active_meeting_id');
      return;
    }

    try {
      const { data: meetingRow, error } = await client
        .from('video_meetings')
        .select('id, room_name, is_active')
        .eq('id', savedId)
        .single();

      if (error || !meetingRow || !meetingRow.is_active) {
        sessionStorage.removeItem('active_meeting_id');
        return;
      }

      const user = await this.supabaseService.getCurrentUser();
      if (!user || !user.email) {
        sessionStorage.removeItem('active_meeting_id');
        return;
      }

      const userName = user.email.split('@')[0];

      let role = '';
      const { data: profileData } = await client
        .from('profiles')
        .select('role')
        .eq('email', user.email)
        .single();
      if (profileData) role = profileData.role;

      const metadataRole = user.user_metadata?.['role'] || user.app_metadata?.['role'];
      const resolvedRole = role || metadataRole || '';
      const isAdmin =
        resolvedRole.toLowerCase() === 'admin' ||
        user.email === 'admin@orphanage.com' ||
        user.email.toLowerCase().includes('admin') ||
        user.email.toLowerCase() === 'diyafamaaz@gmail.com';

      this.join(meetingRow.room_name, user.email, userName, meetingRow.id, isAdmin);
    } catch (err) {
      console.warn('[MeetingService] restoreIfAny failed', err);
      sessionStorage.removeItem('active_meeting_id');
    }
  }
}