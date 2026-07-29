import { Injectable } from '@angular/core';

declare var JitsiMeetExternalAPI: any;

// Minimal ambient typing for the Document Picture-in-Picture API (Chrome/Edge 116+).
// Not yet in lib.dom.d.ts, so we declare just what we use.
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

@Injectable({
  providedIn: 'root'
})
export class VideoCallStateService {
  private api: any;

  public activeMeetingId: string | null = null;
  public currentRoomName: string | null = null;
  public isMinimized: boolean = false;
  public isExternalPiP: boolean = false; // true when using the real OS-level PiP window
  public isChatOpen: boolean = false; // mirrors Jitsi's own built-in chat panel, if used
  public isAudioMuted: boolean = false;
  public isVideoMuted: boolean = false;

  // Custom Meet-style chat panel. Lives here (singleton) so history survives
  // navigating away and back, exactly like Google Meet.
  public chatMessages: ChatMessage[] = [];
  public isChatPanelOpen: boolean = false;

  // Component wires this up so we can trigger Angular change detection when
  // Jitsi events (chat messages, mute state) arrive outside a click handler.
  public onStateChanged: (() => void) | null = null;

  private globalContainer: HTMLElement | null = null;
  private controlsBar: HTMLElement | null = null;
  private pipWindow: Window | null = null;

  // The video-call component wires this up so the mini "expand" button
  // can navigate back to the page even when it's not currently mounted.
  public onRequestExpand: (() => void) | null = null;

  constructor() {
    this.createGlobalContainer();
    this.warnBeforeUnload();
    this.watchVisibilityForAutoPiP();
  }

  // Real out-of-tab PiP is only allowed to auto-trigger from a visibilitychange
  // handler (this is the browser's sanctioned "auto Picture-in-Picture" exception
  // to the user-gesture requirement — it's how Meet pops out when you switch tabs).
  // Switching between routes INSIDE your app does not hide the document, so this
  // deliberately does NOT fire for in-app navigation — that case uses the plain
  // in-page floating card instead, via ngOnDestroy -> minimizeToPiP(false).
  private watchVisibilityForAutoPiP(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.api && this.activeMeetingId && !this.isExternalPiP) {
        console.log('[VideoCallState] tab hidden with active call -> attempting real PiP');
        this.tryEnterExternalPiP();
      }
    });
  }

  // ---------------------------------------------------------------------
  // setup
  // ---------------------------------------------------------------------

  private createGlobalContainer(): void {
    if (!document.getElementById('global-jitsi-wrapper')) {
      this.globalContainer = document.createElement('div');
      this.globalContainer.id = 'global-jitsi-wrapper';
      this.globalContainer.style.position = 'fixed';
      this.globalContainer.style.zIndex = '999999';
      this.globalContainer.style.background = '#202124';
      this.globalContainer.style.borderRadius = '16px';
      this.globalContainer.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.4)';
      this.globalContainer.style.overflow = 'hidden';
      this.globalContainer.style.display = 'none';
      document.body.appendChild(this.globalContainer);
    } else {
      this.globalContainer = document.getElementById('global-jitsi-wrapper');
    }
  }

  // Google Meet warns you before you close/refresh a tab mid-call. Same idea here.
  private warnBeforeUnload(): void {
    window.addEventListener('beforeunload', (e) => {
      if (this.api && this.activeMeetingId) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  public supportsExternalPiP(): boolean {
    return typeof window !== 'undefined' && !!(window as any).documentPictureInPicture;
  }

  // ---------------------------------------------------------------------
  // meeting lifecycle
  // ---------------------------------------------------------------------

  public initializeMeeting(roomName: string, userEmail: string, userName: string): void {
    console.log('[VideoCallState] initializeMeeting called', { roomName, hasApi: !!this.api, currentRoomName: this.currentRoomName });
    // Already running this room somewhere (full view or PiP) -> just bring it forward
    if (this.api && this.currentRoomName === roomName) {
      console.log('[VideoCallState] same room already live -> expanding, not recreating');
      this.expandToFullScreen();
      return;
    }

    if (this.api) {
      console.warn('[VideoCallState] a different room was live -> disposing it before starting the new one');
      this.disposeMeeting();
    }

    this.currentRoomName = roomName;
    const domain = 'meet.jit.si';

    const options = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: this.globalContainer, // Always lives in the global wrapper
      userInfo: {
        email: userEmail,
        displayName: userName
      },
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
          'favourite', 'raisehand', 'videoquality', 'tileview', 'settings', 'stats'
        ]
      }
    };

    this.api = new JitsiMeetExternalAPI(domain, options);
    this.bindApiEvents();
    this.expandToFullScreen();
  }

  private bindApiEvents(): void {
    if (!this.api) return;

    // Mirror Jitsi's own state so our mini PiP controls (and any UI you build later)
    // can stay accurate without polling.
    this.api.addEventListener('chatUpdated', (data: any) => {
      this.isChatOpen = !!data?.isOpen;
    });
    this.api.addEventListener('audioMuteStatusChanged', (data: any) => {
      this.isAudioMuted = !!data?.muted;
      this.refreshControlsIfVisible();
      this.onStateChanged?.();
    });
    this.api.addEventListener('videoMuteStatusChanged', (data: any) => {
      this.isVideoMuted = !!data?.muted;
      this.refreshControlsIfVisible();
      this.onStateChanged?.();
    });
    this.api.addEventListener('readyToClose', () => {
      // Fired when the user hangs up from inside the Jitsi UI itself
      this.disposeMeeting();
    });

    // Custom Meet-style chat: messages from other participants
    this.api.addEventListener('incomingMessage', (data: any) => {
      this.chatMessages.push({
        id: Math.random().toString(36).slice(2),
        from: data?.nick || data?.from || 'Participant',
        text: data?.message || '',
        timestamp: Date.now(),
        isLocal: false
      });
      this.onStateChanged?.();
    });
  }

  // Sends via Jitsi's real data channel, then mirrors it into our own panel
  // immediately (Jitsi's own 'outgoingMessage' event isn't reliably fired for
  // programmatic sends via executeCommand, so we don't depend on it).
  public sendChatMessage(text: string): void {
    const trimmed = text.trim();
    if (!this.api || !trimmed) return;

    this.api.executeCommand('sendChatMessage', trimmed);
    this.chatMessages.push({
      id: Math.random().toString(36).slice(2),
      from: 'You',
      text: trimmed,
      timestamp: Date.now(),
      isLocal: true
    });
    this.onStateChanged?.();
  }

  public toggleChatPanel(): void {
    this.isChatPanelOpen = !this.isChatPanelOpen;
  }

  // ---------------------------------------------------------------------
  // full view
  // ---------------------------------------------------------------------

  public expandToFullScreen(): void {
    this.closeExternalPiPWindow();
    this.reattachToMainDocument();
    this.removeControlsBar();

    if (this.globalContainer) {
      this.globalContainer.style.display = 'block';
      this.globalContainer.style.position = 'fixed';
      this.globalContainer.style.top = '0px';
      this.globalContainer.style.left = '0px';
      this.globalContainer.style.bottom = '0px';
      this.globalContainer.style.right = '0px';
      this.globalContainer.style.width = '100vw';
      this.globalContainer.style.height = '100vh';
      this.globalContainer.style.borderRadius = '0px';
    }

    this.isMinimized = false;
    this.isExternalPiP = false;
  }

  // ---------------------------------------------------------------------
  // minimize / picture-in-picture
  // ---------------------------------------------------------------------

  /**
   * Tries real OS-level Picture-in-Picture first (visible even when the tab
   * loses focus or you switch to another app). Falls back to an in-page
   * floating card on browsers that don't support Document PiP.
   *
   * Note: like Google Meet, this survives switching tabs/apps and navigating
   * around inside your Angular app, but it cannot survive fully closing the
   * browser tab — the call needs a live JS/WebRTC context to keep running.
   */
  public async minimizeToPiP(attemptRealPiP: boolean = true): Promise<void> {
    console.log('[VideoCallState] minimizeToPiP called', { attemptRealPiP, hasApi: !!this.api, hasContainer: !!this.globalContainer });
    if (!this.api || !this.globalContainer) {
      console.warn('[VideoCallState] minimizeToPiP aborted: no active api/container');
      return;
    }

    if (attemptRealPiP && this.supportsExternalPiP()) {
      const opened = await this.tryEnterExternalPiP();
      if (opened) return;
    }
    this.enterInPagePiP();
  }

  private async tryEnterExternalPiP(): Promise<boolean> {
    try {
      const pipWin = await (window as any).documentPictureInPicture.requestWindow({
        width: 360,
        height: 260
      });

      this.pipWindow = pipWin;
      this.isExternalPiP = true;

      this.copyStylesInto(pipWin.document);
      pipWin.document.title = 'Meeting';
      pipWin.document.body.style.margin = '0';
      pipWin.document.body.style.overflow = 'hidden';
      pipWin.document.body.style.background = '#202124';

      this.reattachToMainDocument(); // make sure it isn't already parented elsewhere
      this.globalContainer!.style.position = 'relative';
      this.globalContainer!.style.top = '';
      this.globalContainer!.style.left = '';
      this.globalContainer!.style.bottom = '';
      this.globalContainer!.style.right = '';
      this.globalContainer!.style.width = '100%';
      this.globalContainer!.style.height = '100%';
      this.globalContainer!.style.borderRadius = '0px';
      this.globalContainer!.style.display = 'block';

      // Move the LIVE node (not a clone) into the PiP window's document.
      // The Jitsi iframe keeps its connection - it does not reload.
      pipWin.document.body.appendChild(this.globalContainer!);

      this.buildControlsBar(pipWin.document, true);

      pipWin.addEventListener('pagehide', () => {
        // Fires when the user closes the mini window, or the browser closes it for us
        this.pipWindow = null;
        this.isExternalPiP = false;
        if (this.api) {
          this.enterInPagePiP();
        }
      }, { once: true });

      this.isMinimized = true;
      return true;
    } catch (err) {
      console.warn('Document Picture-in-Picture unavailable, using in-page floating view instead.', err);
      this.pipWindow = null;
      this.isExternalPiP = false;
      return false;
    }
  }

  private enterInPagePiP(): void {
    console.log('[VideoCallState] entering in-page floating card');
    if (!this.globalContainer) {
      console.warn('[VideoCallState] enterInPagePiP aborted: no container');
      return;
    }

    this.reattachToMainDocument();

    this.globalContainer.style.display = 'block';
    this.globalContainer.style.position = 'fixed';
    this.globalContainer.style.top = '';
    this.globalContainer.style.left = '';
    this.globalContainer.style.bottom = '24px';
    this.globalContainer.style.right = '24px';
    this.globalContainer.style.width = '360px';
    this.globalContainer.style.height = '220px';
    this.globalContainer.style.borderRadius = '16px';

    this.buildControlsBar(document, false);

    this.isMinimized = true;
    this.isExternalPiP = false;
  }

  private closeExternalPiPWindow(): void {
    if (this.pipWindow) {
      try { this.pipWindow.close(); } catch (e) { /* already closed */ }
      this.pipWindow = null;
    }
  }

  private reattachToMainDocument(): void {
    if (this.globalContainer && this.globalContainer.ownerDocument !== document) {
      document.body.appendChild(this.globalContainer);
    }
  }

  // ---------------------------------------------------------------------
  // mini control bar (mic / camera / chat / expand / leave)
  // Jitsi's own toolbar gets cramped at PiP size, so we overlay a small,
  // fully-controlled bar that talks to Jitsi via executeCommand (works
  // across the cross-origin iframe boundary via postMessage).
  // ---------------------------------------------------------------------

  private removeControlsBar(): void {
    if (this.controlsBar) {
      this.controlsBar.remove();
      this.controlsBar = null;
    }
  }

  private buildControlsBar(doc: Document, external: boolean): void {
    this.removeControlsBar();
    if (!this.globalContainer) return;

    const bar = doc.createElement('div');
    bar.style.position = 'absolute';
    bar.style.left = '0';
    bar.style.right = '0';
    bar.style.bottom = '0';
    bar.style.display = 'flex';
    bar.style.justifyContent = 'center';
    bar.style.gap = '10px';
    bar.style.padding = '8px';
    bar.style.background = 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)';
    bar.style.zIndex = '1000000';
    bar.style.pointerEvents = 'auto';

    const mkBtn = (label: string, title: string, onClick: () => void) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.title = title;
      b.style.border = 'none';
      b.style.borderRadius = '50%';
      b.style.width = '32px';
      b.style.height = '32px';
      b.style.cursor = 'pointer';
      b.style.background = 'rgba(255,255,255,0.15)';
      b.style.color = '#fff';
      b.style.fontSize = '14px';
      b.style.lineHeight = '1';
      b.onclick = (e) => { e.stopPropagation(); onClick(); };
      return b;
    };

    bar.appendChild(mkBtn(this.isAudioMuted ? '🔇' : '🎤', 'Toggle microphone', () => {
      this.api?.executeCommand('toggleAudio');
    }));
    bar.appendChild(mkBtn(this.isVideoMuted ? '📷' : '📹', 'Toggle camera', () => {
      this.api?.executeCommand('toggleVideo');
    }));

    bar.appendChild(mkBtn('⤢', 'Back to full view', () => {
      if (this.onRequestExpand) {
        this.onRequestExpand();
      } else {
        this.expandToFullScreen();
      }
    }));

    bar.appendChild(mkBtn('✕', 'Leave call', () => {
      this.api?.executeCommand('hangup');
    }));

    this.globalContainer.appendChild(bar);
    this.controlsBar = bar;
  }

  private refreshControlsIfVisible(): void {
    if (this.controlsBar && (this.isMinimized || this.isExternalPiP)) {
      this.buildControlsBar(this.controlsBar.ownerDocument, this.isExternalPiP);
    }
  }

  // Copies same-origin stylesheets into the PiP window and links cross-origin
  // ones, so the mini control bar (and any host page styling) renders correctly
  // in the separate window/document that Document PiP creates.
  private copyStylesInto(targetDoc: Document): void {
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
        const style = targetDoc.createElement('style');
        style.textContent = rules;
        targetDoc.head.appendChild(style);
      } catch {
        // Cross-origin sheet: cssRules is unreadable, so link it directly instead
        const href = (sheet as CSSStyleSheet).href;
        if (href) {
          const link = targetDoc.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          targetDoc.head.appendChild(link);
        }
      }
    });
  }

  // ---------------------------------------------------------------------
  // teardown
  // ---------------------------------------------------------------------

  public disposeMeeting(): void {
    console.warn('[VideoCallState] disposeMeeting called - here is the call stack:');
    console.trace();
    this.closeExternalPiPWindow();
    this.removeControlsBar();

    if (this.api) {
      try { this.api.dispose(); } catch (e) { /* ignore */ }
      this.api = null;
      this.currentRoomName = null;
    }

    this.activeMeetingId = null;
    this.isMinimized = false;
    this.isExternalPiP = false;
    this.isChatOpen = false;
    this.isChatPanelOpen = false;
    this.chatMessages = [];

    this.reattachToMainDocument();
    if (this.globalContainer) {
      this.globalContainer.style.display = 'none';
      this.globalContainer.innerHTML = '';
    }
    sessionStorage.removeItem('active_meeting_id');
  }
}