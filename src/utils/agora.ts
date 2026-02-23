import AgoraRTC, { IAgoraRTCClient, ILocalVideoTrack, ILocalAudioTrack, IRemoteVideoTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { AGORA_APP_ID } from '@/lib/agora';

// Agora configuration
// No longer hardcoded here to maintain consistency with environment variables

export interface AgoraCallState {
  client: IAgoraRTCClient | null;
  localAudioTrack: ILocalAudioTrack | null;
  localVideoTrack: ILocalVideoTrack | null;
  remoteAudioTrack: IRemoteAudioTrack | null;
  remoteVideoTrack: IRemoteVideoTrack | null;
  isJoined: boolean;
  isPublished: boolean;
}

export class AgoraManager {
  private client: IAgoraRTCClient | null = null;
  private localAudioTrack: ILocalAudioTrack | null = null;
  private localVideoTrack: ILocalVideoTrack | null = null;
  private remoteAudioTrack: IRemoteAudioTrack | null = null;
  private remoteVideoTrack: IRemoteVideoTrack | null = null;
  private isJoined = false;
  private isPublished = false;

  async initializeClient(): Promise<IAgoraRTCClient> {
    if (this.client) return this.client;

    this.client = AgoraRTC.createClient({
      mode: 'rtc',
      codec: 'vp8'
    });

    return this.client;
  }

  async joinChannel(channelName: string, token: string | null = null, uid?: string | number): Promise<void> {
    if (!this.client) throw new Error('Client not initialized');

    try {
      // Ensure token is null if undefined is passed
      const finalToken = token || null;
      const result = await this.client.join(AGORA_APP_ID, channelName, finalToken, uid || null);
      this.isJoined = true;
      console.log('Joined channel:', result);
    } catch (error) {
      console.error('Failed to join channel:', error);
      throw error;
    }
  }

  async createLocalTracks(audio: boolean = true, video: boolean = false): Promise<void> {
    try {
      const tracks = await AgoraRTC.createMicrophoneAndCameraTracks(
        audio ? {} : undefined,
        video ? {} : undefined
      );

      if (audio && tracks[0]) {
        this.localAudioTrack = tracks[0] as ILocalAudioTrack;
      }

      if (video && tracks[1]) {
        this.localVideoTrack = tracks[1] as ILocalVideoTrack;
      }
    } catch (error) {
      console.error('Failed to create local tracks:', error);
      throw error;
    }
  }

  async publishTracks(): Promise<void> {
    if (!this.client || !this.isJoined) throw new Error('Client not joined');

    const tracksToPublish: (ILocalAudioTrack | ILocalVideoTrack)[] = [];
    if (this.localAudioTrack) tracksToPublish.push(this.localAudioTrack);
    if (this.localVideoTrack) tracksToPublish.push(this.localVideoTrack);

    if (tracksToPublish.length > 0) {
      await this.client.publish(tracksToPublish);
      this.isPublished = true;
      console.log('Tracks published');
    }
  }

  async setupRemoteTracks(): Promise<void> {
    if (!this.client) return;

    this.client.on('user-published', async (user, mediaType) => {
      await this.client!.subscribe(user, mediaType);

      if (mediaType === 'audio') {
        this.remoteAudioTrack = user.audioTrack!;
        this.remoteAudioTrack.play();
      } else if (mediaType === 'video') {
        this.remoteVideoTrack = user.videoTrack!;
        // Video will be played in the component
      }

      console.log('Remote track received:', mediaType);
    });

    this.client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'audio' && this.remoteAudioTrack) {
        this.remoteAudioTrack.stop();
        this.remoteAudioTrack = null;
      } else if (mediaType === 'video' && this.remoteVideoTrack) {
        this.remoteVideoTrack.stop();
        this.remoteVideoTrack = null;
      }

      console.log('Remote track unpublished:', mediaType);
    });
  }

  async leaveChannel(): Promise<void> {
    if (this.localAudioTrack) {
      this.localAudioTrack.stop();
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }

    if (this.localVideoTrack) {
      this.localVideoTrack.stop();
      this.localVideoTrack.close();
      this.localVideoTrack = null;
    }

    if (this.remoteAudioTrack) {
      this.remoteAudioTrack.stop();
      this.remoteAudioTrack = null;
    }

    if (this.remoteVideoTrack) {
      this.remoteVideoTrack.stop();
      this.remoteVideoTrack = null;
    }

    if (this.client && this.isJoined) {
      await this.client.leave();
      this.isJoined = false;
      this.isPublished = false;
    }
  }

  muteAudio(mute: boolean): void {
    if (this.localAudioTrack) {
      this.localAudioTrack.setMuted(mute);
    }
  }

  muteVideo(mute: boolean): void {
    if (this.localVideoTrack) {
      this.localVideoTrack.setMuted(mute);
    }
  }

  getState(): AgoraCallState {
    return {
      client: this.client,
      localAudioTrack: this.localAudioTrack,
      localVideoTrack: this.localVideoTrack,
      remoteAudioTrack: this.remoteAudioTrack,
      remoteVideoTrack: this.remoteVideoTrack,
      isJoined: this.isJoined,
      isPublished: this.isPublished
    };
  }

  getRemoteVideoTrack(): IRemoteVideoTrack | null {
    return this.remoteVideoTrack;
  }

  getLocalVideoTrack(): ILocalVideoTrack | null {
    return this.localVideoTrack;
  }
}

// Singleton instance
export const agoraManager = new AgoraManager();