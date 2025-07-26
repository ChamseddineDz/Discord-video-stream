import OpusScript from "opusscript";
import type { MediaUdp } from "../client/voice/MediaUdp.js";
import { BaseMediaStream } from "./BaseMediaStream.js";

export class AudioStream extends BaseMediaStream {
    public udp: MediaUdp;
    private _isMuted: boolean; // Internal state for muting
    private _volume: number = 1.0;
    private _opusEncoder: OpusScript;

    

    constructor(udp: MediaUdp, noSleep = false, initialMuted: boolean = false) {
        super("audio", noSleep);
        this.udp = udp;
        this._isMuted = initialMuted; // Initialize mute state
        this._opusEncoder = new OpusScript(48000, 2, 2048);
    }

    /**
     * Mutes the audio stream. No audio frames will be sent.
     */
    public mute(): void {
        this._isMuted = true;
    }

    /**
     * Unmutes the audio stream. Audio frames will resume sending.
     */
    public unmute(): void {
        this._isMuted = false;
    }

    /**
     * Checks if the audio stream is currently muted.
     * @returns True if muted, false otherwise.
     */
    public isMuted(): boolean {
        return this._isMuted;
    }

    public setVolume(volume: number): void {
        if (volume < 0) {
            this._volume = 0;
        } else {
            this._volume = Math.min(volume, 2.0);
        }
    }

    public getVolume(): number {
        return this._volume;
    }

    protected override async _sendFrame(frame: Buffer, frametime: number): Promise<void> {
        if (this._isMuted) {
            return;
        }

        let processedFrame = frame;

        if (this._volume !== 1.0) {
            try {
                const pcmData = this._opusEncoder.decode(frame);

                for (let i = 0; i < pcmData.length; i += 2) {
                    const sample = pcmData.readInt16LE(i);
                    const newSample = Math.max(-32768, Math.min(32767, Math.floor(sample * this._volume)));
                    pcmData.writeInt16LE(newSample, i);
                }

                processedFrame = this._opusEncoder.encode(pcmData, 960);
            } catch (error) {
                console.error("[AudioStream] Error processing audio frame:", error);
                processedFrame = frame;
            }
        }

        await this.udp.sendAudioFrame(processedFrame, frametime);
    }

}