import { Injectable, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase';
import { KJUR } from 'jsrsasign';

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

  // ---- JaaS Configuration Constants ----
  private readonly JAAS_APP_ID = 'vpaas-magic-cookie-1cf2385cabf845f9b562248f29151bb9';
  private readonly JAAS_KID = 'vpaas-magic-cookie-1cf2385cabf845f9b562248f29151bb9/8ff6d4'; 
  private readonly RSA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDUz2AYM0dt8Nju
bVjElW5lbxFfCb3L8Jv79Sq6E+wXIpAzcA4Yzq+Zu3MKM49nWShUGLoVFDodM6BV
YPuibPzFuMoO+D0PlV9NZn1PB67c5iH1KuaRPpUukQuzIKOSldApSgbwDsVD0cl5
KXGyhzKa00lBrG3ZRTnbs77nmCG0M55HY0UilfazXo0sKoetMGcIDQIUxgB9KJti
5Ia6ANKJGoaHNoV6WMH6uQFc+GowTQoFGtOymgXB7zYtFAHLlHCeW4QC0v9tsx1I
QIPEYmvzjVGsW2SQ+floGSIM7jJrvIef+9a2j/1bXL5nG4ICCNwJcuq9D7s2dV7M
SXWp9UUfAgMBAAECggEBAKN9HWn6GyoPGdkyEDwWQNWUWlgU98axdmQ+mTCTFZFA
cF/T+kB8qNMF+v8fVVAkYqMYy/xdqbe9bbOp6ieCaz7LFBAkDWTncGvaDPKmCGSU
OApNhwyWc61uqPpYXNHEXkMaJ/JMpqfPh2SZvktVKj9fiqv1d/6u/CAZGtR5P4tb
pWd9NuVNMeWhdT/wLJifzaqXWlLijp4lTvW7aFO17RTZCV9P3EVWvEHYdp163yvA
8K1/1Q4ZoHYI8eRRO/ZOv3+e3P7pJKta3toWFCCsqvUdXGKAQ/DmgUu3C8FvoECu
Krs0ESq5Jl5N/mGOmDx7CunBWfggROSw6ZwSfVOiJ2ECgYEA9amPE7mXOqg6U/Q3
zENQ2ZpvAjKVlBJki1meQCE19GFdgjcCdix34jFvdwqNf8OpycF0miGkbS/iibHu
uoO5N89nk05Bj/DMI/D5kY9pLA+t9rm7P46xt73tERnb4mp08qKk0XQyznXuInmH
ZEdwLL++1OZCiUOTW+eZKxdmt2UCgYEA3cPo0wwb4jRUgz5OjrSipcLZtWSN2cX2
vYxiaeirn7jxrqAq+Hp3IGDTSk6WIbDfY74QVn9+znLiRLpsR02oyzFG+p8ZpOoa
CFiIi/OaEUkiz20+JDrpkeN78B7soxs4G4BI8cf5zdLXRGn7365WBLSPb9REqG+H
KwlRUvDuDDMCgYB39EiR6CCpGrYIgoqwafpTlu43k32oZObFiIgWZmETKGvhhnzk
OUh8oYj9BqEbTu5cPuNx05WXXzdt5v1cA6/wSY0Yx7CJ2ZnEvwkOA4nmYu2eOQju
uv2aa9oTbJ4Ky9K5G6QBRoz8dWdHXDI5TAzBPQuwp5K7tcyBpvAKs42LZQKBgCyT
NVg+hdhI9nfO7VFn4414BfSc+po8XWUqM5ngJ6caMJIOJbT+QLWkYLP96dVpzO0q
hfQs+lsa4no4Eo2egYAeLosvsaLhX0wwJ3oiA+TXk4SoC6aSpOIrHH1eaeg7D2MP
vRnEPWTurVBWEUebrjSR6obq3sYQbNXssIkAXojbAoGBAIRgOdizpPNI8ZTHgb2j
RnD6q1DfdjyGNfx2V04L9nss1dQNMKsreeUZlXQu5/35LsVMtsyQq5p09TvKFPc5
cIz0ccW001MbmzaMRF0bb808gQBsV1s3voKwvgm4NMjgy4X+hopijEd5bN16i1sG
+r/HF70K2rZ3Z+f6gy5ORXoZ
-----END PRIVATE KEY-----`;

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
  readonly latestReaction = signal<{ user: string; emoji: string } | null>(null);

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

  registerHost(jitsiContainer: HTMLElement, hostElement: HTMLElement): void {
    this.jitsiContainer = jitsiContainer;
    this.hostElement = hostElement;
    if (this.pendingJoin) {
      const p = this.pendingJoin;
      this.pendingJoin = null;
      this.join(p.roomName, p.email, p.name, p.meetingId, p.isAdmin);
    }
  }

  // ---- JWT Generator Helper -------------------------------------------

  private generateJaaSJwt(userEmail: string, userName: string, roomName: string, isAdmin: boolean): string {
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: this.JAAS_KID
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 7200; // 2 hours expiration

    const payload = {
      aud: 'jitsi',
      iss: 'chat',
      sub: this.JAAS_APP_ID,
      room: roomName,
      nbf: now - 10,
      exp: exp,
      context: {
        user: {
          id: userEmail,
          name: userName,
          email: userEmail,
          moderator: isAdmin ? 'true' : 'false'
        },
        features: {
          livestreaming: false,
          recording: false,
          transcription: false
        }
      }
    };

    try {
      const sHeader = JSON.stringify(header);
      const sPayload = JSON.stringify(payload);
      return KJUR.jws.JWS.sign('RS256', sHeader, sPayload, this.RSA_PRIVATE_KEY);
    } catch (err) {
      console.error('[MeetingService] Failed to sign JaaS JWT:', err);
      return '';
    }
  }

  // ---- lifecycle --------------------------------------------------------

  join(roomName: string, userEmail: string, userName: string, meetingId: string, isAdmin: boolean): void {
    if (!this.jitsiContainer) {
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
    this.latestReaction.set(null);

    // Prefix room with your JaaS App ID
    const fullRoomName = `${this.JAAS_APP_ID}/${roomName}`;
    const jwtToken = this.generateJaaSJwt(userEmail, this.localDisplayName, roomName, isAdmin);

    const domain = '8x8.vc';
    const options = {
      roomName: fullRoomName,
      jwt: jwtToken,
      width: '100%',
      height: '100%',
      parentNode: this.jitsiContainer,
      userInfo: { email: userEmail, displayName: this.localDisplayName },
      configOverwrite: {
        startWithAudioMuted: true,
        startWithVideoMuted: true,
        prejoinPageEnabled: false,
        disableModeratorIndicator: true,
        enableLobby: false,
        requireDisplayName: false,
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
          'favourite', 'raisehand', 'videoquality', 'tileview', 'settings', 'stats', 'hangup', 'reactions'
        ]
      }
    };

    this.api = new JitsiMeetExternalAPI(domain, options);
    this.bindApiEvents();
    this.expand();

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

    this.api.addEventListener('reactionReceived', (d: any) => {
      if (d?.reaction) {
        this.latestReaction.set({ user: d.participantId || 'Participant', emoji: d.reaction });
        setTimeout(() => this.latestReaction.set(null), 3000);
      }
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

  expand(): void {
    this.closeExternalPip();
    this.reattachToHost();
    this.mode.set('full');
    setTimeout(() => {
      this.api?.executeCommand?.('resize');
    }, 50);
  }

  minimize(): void {
    if (!this.api) return;
    this.mode.set('floating');
    setTimeout(() => {
      this.api?.executeCommand?.('resize');
    }, 50);
  }

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

  async leaveCall(): Promise<void> {
    this.api?.executeCommand?.('hangup');
    await this.recordAttendance();
    this.teardown();
  }

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
    this.latestReaction.set(null);
    sessionStorage.removeItem('active_meeting_id');
  }

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