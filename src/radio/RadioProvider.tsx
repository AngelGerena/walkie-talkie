import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ConnectionState,
  createLocalAudioTrack,
  LocalAudioTrack,
  RemoteParticipant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
} from 'livekit-client';
import { callFunction, LIVEKIT_URL, supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { CHANNEL_COLUMNS, Alert, Channel, Transmission } from '../lib/types';
import { sounds } from '../lib/sounds';
import { getSettings, useSettings } from '../lib/settings';
import { useWakeLock } from '../lib/wakeLock';
import { PresenceEntry, useTeamPresence } from '../lib/presence';
import { useTeamFeed } from '../lib/feed';
import { vibrate } from '../lib/platform';

export type Conn = 'off' | 'connecting' | 'on' | 'reconnecting' | 'error';

export interface FloorHolder {
  id: string;
  callsign: string;
  ts: number;
  lead: boolean;
  self: boolean;
}

interface FloorMsg {
  t: 'take' | 'release';
  id: string;
  callsign: string;
  ts: number;
  lead: boolean;
}

interface RadioValue {
  channels: Channel[];
  channel: Channel | null;
  channelIndex: number;
  selectChannel: (id: string) => void;
  onDuty: boolean;
  goOnDuty: () => Promise<void>;
  goOffDuty: () => Promise<void>;
  conn: Conn;
  connError: string | null;
  needsAudio: boolean;
  unlockAudio: () => Promise<void>;
  floor: FloorHolder | null;
  talking: boolean;
  talkStartedAt: number | null;
  startTalk: () => Promise<boolean>;
  stopTalk: () => Promise<void>;
  unitsHere: number;
  presence: PresenceEntry[];
  transmissions: Transmission[];
  alerts: Alert[];
  reloadFeed: () => Promise<void>;
  activeAlert: Alert | null;
  dismissAlert: () => void;
}

const Ctx = createContext<RadioValue | null>(null);
const MAX_TALK_MS = 60000;
const CHANNEL_KEY = 'sd-radio-channel';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const options = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/aac'];
  for (const m of options) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignore */
    }
  }
  return '';
}

function extFor(mime: string): string {
  return mime.includes('mp4') || mime.includes('aac') ? 'm4a' : 'webm';
}

function describeError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'mic';
  return e instanceof Error ? e.message : 'generic';
}

export function RadioProvider({ children }: { children: ReactNode }) {
  const { member, isLead } = useAuth();
  const settings = useSettings();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState<string | null>(() => localStorage.getItem(CHANNEL_KEY));
  const [onDuty, setOnDuty] = useState(false);
  const [conn, setConn] = useState<Conn>('off');
  const [connError, setConnError] = useState<string | null>(null);
  const [needsAudio, setNeedsAudio] = useState(false);
  const [floor, setFloor] = useState<FloorHolder | null>(null);
  const [talking, setTalking] = useState(false);
  const [talkStartedAt, setTalkStartedAt] = useState<number | null>(null);
  const [roomCount, setRoomCount] = useState(0);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);

  const roomRef = useRef<Room | null>(null);
  const trackRef = useRef<LocalAudioTrack | null>(null);
  const floorRef = useRef<FloorHolder | null>(null);
  const floorTimer = useRef<number | null>(null);
  const talkingRef = useRef(false);
  const myTakeRef = useRef<FloorMsg | null>(null);
  const maxTimer = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onDutyRef = useRef(false);
  const intentionalRef = useRef(false);
  const connectSeq = useRef(0);
  const sinkRef = useRef<HTMLDivElement | null>(null);
  const channelIdRef = useRef<string | null>(channelId);
  channelIdRef.current = channelId;

  // ---------- channels ----------
  useEffect(() => {
    if (!member) return;
    void supabase
      .from('channels')
      .select(CHANNEL_COLUMNS)
      .eq('team_id', member.team_id)
      .order('sort')
      .then(({ data }) => {
        const list = (data || []) as Channel[];
        setChannels(list);
        setChannelId((cur) => (cur && list.some((c) => c.id === cur) ? cur : list[0]?.id ?? null));
      });
  }, [member]);

  const channel = useMemo(() => channels.find((c) => c.id === channelId) ?? null, [channels, channelId]);
  const channelIndex = channel ? channels.indexOf(channel) : -1;

  // ---------- feed + alerts ----------
  const handleNewAlert = useCallback(
    (a: Alert) => {
      if (a.member_id === member?.id) return;
      setActiveAlert(a);
      sounds.alarm();
      vibrate([400, 150, 400, 150, 800]);
    },
    [member?.id],
  );
  const { transmissions, alerts, reload: reloadFeed } = useTeamFeed(member?.team_id, handleNewAlert);

  // ---------- presence ----------
  const selfPresence: PresenceEntry | null = member
    ? {
        member_id: member.id,
        callsign: member.callsign,
        post: member.post,
        role: member.role,
        channel_id: onDuty ? channelId : null,
        talking,
      }
    : null;
  const presence = useTeamPresence(member?.team_id, selfPresence);

  // ---------- helpers ----------
  const sink = () => {
    if (!sinkRef.current) {
      const el = document.createElement('div');
      el.id = 'audio-sink';
      el.style.display = 'none';
      document.body.appendChild(el);
      sinkRef.current = el;
    }
    return sinkRef.current;
  };

  const applyMute = (muted: boolean) => {
    sink()
      .querySelectorAll('audio')
      .forEach((el) => {
        (el as HTMLAudioElement).muted = muted;
      });
  };

  useEffect(() => applyMute(settings.muted), [settings.muted]);

  const setFloorState = useCallback((f: FloorHolder | null) => {
    floorRef.current = f;
    setFloor(f);
    if (floorTimer.current) window.clearTimeout(floorTimer.current);
    floorTimer.current = null;
    if (f && !f.self) {
      floorTimer.current = window.setTimeout(() => {
        if (floorRef.current === f) {
          floorRef.current = null;
          setFloor(null);
        }
      }, MAX_TALK_MS + 5000);
    }
  }, []);

  const publish = (msg: FloorMsg) => {
    const room = roomRef.current;
    if (!room) return;
    void room.localParticipant
      .publishData(encoder.encode(JSON.stringify(msg)), { reliable: true, topic: 'floor' })
      .catch(() => undefined);
  };

  const syncCount = (room: Room) => setRoomCount(room.remoteParticipants.size + 1);

  // ---------- recording ----------
  const startRecorder = (track: LocalAudioTrack) => {
    const mime = pickMime();
    if (mime === null) return;
    try {
      const rec = new MediaRecorder(new MediaStream([track.mediaStreamTrack]), mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start(250);
      recorderRef.current = rec;
    } catch {
      recorderRef.current = null;
    }
  };

  const finishRecorder = (startedAt: number, chId: string | null) => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (!rec || !member || !chId) return;
    const durationMs = Date.now() - startedAt;
    rec.onstop = async () => {
      const type = rec.mimeType || chunksRef.current[0]?.type || 'audio/webm';
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (durationMs < 700 || blob.size < 800) return;
      const path = `${member.team_id}/${chId}/${crypto.randomUUID()}.${extFor(type)}`;
      const { error: upErr } = await supabase.storage
        .from('transmissions')
        .upload(path, blob, { contentType: type.split(';')[0], upsert: false });
      const { data, error } = await supabase
        .from('transmissions')
        .insert({
          team_id: member.team_id,
          channel_id: chId,
          member_id: member.id,
          callsign: member.callsign,
          started_at: new Date(startedAt).toISOString(),
          duration_ms: durationMs,
          audio_path: upErr ? null : path,
          mime_type: type,
          status: upErr ? 'skipped' : 'pending',
        })
        .select('id')
        .single();
      if (!error && data && !upErr) {
        void callFunction('transcribe-background', { transmission_id: data.id }).catch(() => undefined);
      }
    };
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };

  // ---------- talking ----------
  const stopTalkInner = useCallback(
    async (forced: boolean) => {
      if (!talkingRef.current) return;
      talkingRef.current = false;
      setTalking(false);
      setTalkStartedAt(null);
      if (maxTimer.current) window.clearTimeout(maxTimer.current);
      maxTimer.current = null;
      const take = myTakeRef.current;
      myTakeRef.current = null;
      try {
        await trackRef.current?.mute();
      } catch {
        /* track gone */
      }
      if (take && !forced) publish({ ...take, t: 'release' });
      if (floorRef.current?.self) setFloorState(null);
      if (forced) sounds.busy();
      else if (getSettings().rogerBeep) sounds.roger();
      if (take) finishRecorder(take.ts, channelIdRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [member, setFloorState],
  );

  const stopTalk = useCallback(() => stopTalkInner(false), [stopTalkInner]);

  const startTalk = useCallback(async () => {
    const room = roomRef.current;
    const track = trackRef.current;
    if (!room || !track || !member || talkingRef.current) return false;
    const f = floorRef.current;
    if (f && !f.self && !(isLead && !f.lead)) {
      sounds.busy();
      vibrate([80, 60, 80]);
      return false;
    }
    const take: FloorMsg = { t: 'take', id: room.localParticipant.identity, callsign: member.callsign, ts: Date.now(), lead: isLead };
    myTakeRef.current = take;
    talkingRef.current = true;
    setTalking(true);
    setTalkStartedAt(take.ts);
    setFloorState({ ...take, self: true });
    sounds.chirp();
    try {
      await track.unmute();
    } catch {
      talkingRef.current = false;
      setTalking(false);
      setFloorState(null);
      return false;
    }
    publish(take);
    startRecorder(track);
    maxTimer.current = window.setTimeout(() => void stopTalkInner(false), MAX_TALK_MS);
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, isLead, setFloorState, stopTalkInner]);

  // Incoming floor messages read the latest state through refs.
  const handleFloorRef = useRef<(msg: FloorMsg) => void>(() => undefined);
  handleFloorRef.current = (msg: FloorMsg) => {
    if (msg.t === 'take') {
      if (talkingRef.current && myTakeRef.current) {
        const me = myTakeRef.current;
        const theyWin =
          (msg.lead && !me.lead) ||
          (msg.lead === me.lead && (msg.ts < me.ts || (msg.ts === me.ts && msg.id < me.id)));
        if (!theyWin) return;
        void stopTalkInner(true);
      }
      setFloorState({ ...msg, self: false });
      if (getSettings().vibrate) vibrate(60);
      sounds.incoming();
    } else if (msg.t === 'release') {
      const cur = floorRef.current;
      if (cur && !cur.self && cur.id === msg.id) {
        setFloorState(null);
        if (getSettings().rogerBeep) sounds.roger();
      }
    }
  };

  // ---------- connection ----------
  const teardown = useCallback(async () => {
    intentionalRef.current = true;
    await stopTalkInner(false);
    const room = roomRef.current;
    roomRef.current = null;
    const track = trackRef.current;
    trackRef.current = null;
    try {
      track?.stop();
    } catch {
      /* ignore */
    }
    if (room) await room.disconnect().catch(() => undefined);
    sink().innerHTML = '';
    setFloorState(null);
    setRoomCount(0);
    intentionalRef.current = false;
  }, [setFloorState, stopTalkInner]);

  const connect = useCallback(
    async (chId: string) => {
      if (!member) return;
      if (!LIVEKIT_URL) {
        setConn('error');
        setConnError('The audio server is not set up yet (VITE_LIVEKIT_URL is missing).');
        return;
      }
      const mine = ++connectSeq.current;
      await teardown();
      setConn('connecting');
      setConnError(null);
      try {
        const { token } = await callFunction<{ token: string }>('livekit-token', { channel_id: chId });
        if (mine !== connectSeq.current) return;
        const room = new Room({ adaptiveStream: false, dynacast: false });
        roomRef.current = room;

        room
          .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
            if (track.kind !== Track.Kind.Audio) return;
            const el = track.attach();
            (el as HTMLAudioElement).muted = getSettings().muted;
            sink().appendChild(el);
          })
          .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
            track.detach().forEach((el) => el.remove());
          })
          .on(RoomEvent.ParticipantConnected, () => syncCount(room))
          .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
            syncCount(room);
            if (floorRef.current && floorRef.current.id === p.identity) setFloorState(null);
          })
          .on(RoomEvent.DataReceived, (payload: Uint8Array, _p?: RemoteParticipant, _k?: unknown, topic?: string) => {
            if (topic !== 'floor') return;
            try {
              handleFloorRef.current(JSON.parse(decoder.decode(payload)) as FloorMsg);
            } catch {
              /* malformed */
            }
          })
          .on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudio(!room.canPlaybackAudio))
          .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
            if (roomRef.current !== room) return;
            if (state === ConnectionState.Connected) setConn('on');
            else if (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting) setConn('reconnecting');
          })
          .on(RoomEvent.Disconnected, () => {
            if (roomRef.current !== room || intentionalRef.current) return;
            if (onDutyRef.current && channelIdRef.current) {
              setConn('reconnecting');
              const target = channelIdRef.current;
              window.setTimeout(() => {
                if (onDutyRef.current && channelIdRef.current === target) void connect(target);
              }, 3000);
            } else {
              setConn('off');
            }
          });

        await room.connect(LIVEKIT_URL, token, { autoSubscribe: true });
        if (mine !== connectSeq.current) {
          await room.disconnect();
          return;
        }
        await room.startAudio().catch(() => undefined);
        setNeedsAudio(!room.canPlaybackAudio);

        const track = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
        await room.localParticipant.publishTrack(track, { name: 'ptt', source: Track.Source.Microphone, dtx: true, red: true });
        await track.mute();
        trackRef.current = track;
        syncCount(room);
        setConn('on');
      } catch (e) {
        if (mine !== connectSeq.current) return;
        const reason = describeError(e);
        setConnError(reason);
        setConn('error');
        await teardown();
        if (reason === 'mic') {
          onDutyRef.current = false;
          setOnDuty(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [member, teardown, setFloorState],
  );

  const goOnDuty = useCallback(async () => {
    sounds.unlock();
    const target = channelIdRef.current;
    if (!target) return;
    onDutyRef.current = true;
    setOnDuty(true);
    await connect(target);
  }, [connect]);

  const goOffDuty = useCallback(async () => {
    onDutyRef.current = false;
    setOnDuty(false);
    connectSeq.current++;
    await teardown();
    setConn('off');
  }, [teardown]);

  const selectChannel = useCallback(
    (id: string) => {
      if (id === channelIdRef.current) return;
      setChannelId(id);
      channelIdRef.current = id;
      try {
        localStorage.setItem(CHANNEL_KEY, id);
      } catch {
        /* private mode */
      }
      if (onDutyRef.current) void connect(id);
    },
    [connect],
  );

  const unlockAudio = useCallback(async () => {
    sounds.unlock();
    const room = roomRef.current;
    if (!room) return;
    await room.startAudio().catch(() => undefined);
    setNeedsAudio(!room.canPlaybackAudio);
  }, []);

  // Leave the room cleanly when this provider unmounts (sign out).
  useEffect(() => {
    return () => {
      onDutyRef.current = false;
      connectSeq.current++;
      void teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shift mode keeps the screen on while on duty.
  useWakeLock(settings.shiftMode && onDuty);

  // Headset play/pause toggles talking (beta).
  useEffect(() => {
    if (!settings.headset || !('mediaSession' in navigator)) return;
    const toggle = () => {
      if (talkingRef.current) void stopTalkInner(false);
      else void startTalk();
    };
    try {
      navigator.mediaSession.setActionHandler('play', toggle);
      navigator.mediaSession.setActionHandler('pause', toggle);
    } catch {
      /* unsupported */
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
      } catch {
        /* unsupported */
      }
    };
  }, [settings.headset, startTalk, stopTalkInner]);

  const value: RadioValue = {
    channels,
    channel,
    channelIndex,
    selectChannel,
    onDuty,
    goOnDuty,
    goOffDuty,
    conn,
    connError,
    needsAudio,
    unlockAudio,
    floor,
    talking,
    talkStartedAt,
    startTalk,
    stopTalk,
    unitsHere: conn === 'on' || conn === 'reconnecting' ? roomCount : 0,
    presence,
    transmissions,
    alerts,
    reloadFeed,
    activeAlert,
    dismissAlert: () => setActiveAlert(null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRadio(): RadioValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRadio outside RadioProvider');
  return v;
}
