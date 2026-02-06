import { ZegoExpressEngine } from '@zegocloud/zego-express-engine-webrtc';

// ZegoCloud configuration
export const ZEGO_APP_ID = 1860960087; // ZegoCloud App ID

export interface ZegoCallState {
  engine: ZegoExpressEngine | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isJoined: boolean;
  isPublished: boolean;
}

export class ZegoManager {
  private engine: ZegoExpressEngine | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private isJoined = false;
  private isPublished = false;

  async initializeClient(): Promise<ZegoExpressEngine> {
    if (this.engine) return this.engine;

    this.engine = ZegoExpressEngine.createEngine(ZEGO_APP_ID, {
      logLevel: 'disable',
      logURL: '',
    });

    return this.engine;
  }

  async joinChannel(channelName: string, token: string, uid?: string | number): Promise<void> {
    if (!this.engine) throw new Error('Engine not initialized');

    try {
      await this.engine.loginRoom(channelName, token, {
        userID: uid?.toString() || 'user_' + Math.random().toString(36).substring(2, 15),
        userName: 'User',
      });
      this.isJoined = true;
      console.log('Joined room:', channelName);
    } catch (error) {
      console.error('Failed to join room:', error);
      throw error;
    }
  }

  async createLocalTracks(audio: boolean = true, video: boolean = false): Promise<void> {
    if (!this.engine) throw new Error('Engine not initialized');

    try {
      this.localStream = await this.engine.createLocalStream({
        camera: video ? { video: true } : false,
        microphone: audio,
      });
      console.log('Local stream created');
    } catch (error) {
      console.error('Failed to create local stream:', error);
      throw error;
    }
  }

  async publishTracks(): Promise<void> {
    if (!this.engine || !this.isJoined || !this.localStream) throw new Error('Engine not joined or no local stream');

    try {
      await this.engine.startPublishingStream('stream_' + Math.random().toString(36).substring(2, 15), this.localStream);
      this.isPublished = true;
      console.log('Stream published');
    } catch (error) {
      console.error('Failed to publish stream:', error);
      throw error;
    }
  }

  async setupRemoteTracks(): Promise<void> {
    if (!this.engine) return;

    this.engine.on('roomStreamUpdate', async (roomID, updateType, streamList) => {
      if (updateType === 'ADD') {
        for (const stream of streamList) {
          this.remoteStream = await this.engine!.startPlayingStream(stream.streamID);
          console.log('Remote stream received');
        }
      } else if (updateType === 'DELETE') {
        for (const stream of streamList) {
          this.engine!.stopPlayingStream(stream.streamID);
          this.remoteStream = null;
          console.log('Remote stream removed');
        }
      }
    });
  }

  async leaveChannel(): Promise<void> {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }

    if (this.engine && this.isJoined) {
      await this.engine.logoutRoom();
      this.isJoined = false;
      this.isPublished = false;
    }
  }

  muteAudio(mute: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !mute;
      });
    }
  }

  muteVideo(mute: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = !mute;
      });
    }
  }

  getState(): ZegoCallState {
    return {
      engine: this.engine,
      localStream: this.localStream,
      remoteStream: this.remoteStream,
      isJoined: this.isJoined,
      isPublished: this.isPublished
    };
  }

  getRemoteVideoTrack(): MediaStream | null {
    return this.remoteStream;
  }

  getLocalVideoTrack(): MediaStream | null {
    return this.localStream;
  }
}

// Singleton instance
export const zegoManager = new ZegoManager();
