import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent } from "livekit-client";
import { BOARD } from "./board-data";
import "./App.css";

const TOKEN_ENDPOINT = "http://127.0.0.1:8000/token";
const LIVEKIT_URL = "wss://pcb-design-jdags579.livekit.cloud";

function App() {
  const [phase, setPhase] = useState("idle"); // idle | connecting | live
  const [error, setError] = useState(null);
  const [entries, setEntries] = useState([]); // finalized user transcript lines
  const [liveText, setLiveText] = useState("");
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  const roomRef = useRef(null);
  const audioElsRef = useRef([]);
  const transcriptRef = useRef(null);
  const nextIdRef = useRef(0);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [entries, liveText]);

  const cleanupAudio = () => {
    audioElsRef.current.forEach((el) => el.remove());
    audioElsRef.current = [];
  };

  const disconnect = async () => {
    await roomRef.current?.disconnect();
  };

  const connect = async () => {
    setError(null);
    setPhase("connecting");
    try {
      const response = await fetch(TOKEN_ENDPOINT);
      if (!response.ok) {
        throw new Error(`Token server responded with ${response.status}`);
      }
      const data = await response.json();

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.Disconnected, () => {
        setPhase("idle");
        setAgentSpeaking(false);
        cleanupAudio();
      });

      // Play the agent's voice -- without this, audio silently never plays.
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "audio") {
          const audioElement = track.attach();
          audioElsRef.current.push(audioElement);
          document.body.appendChild(audioElement);
        }
      });

      // LiveKit reports who is actively producing audio right now. The only
      // remote participant in this room is the agent, so if it shows up
      // here, it's speaking -- that's our cue for the aura animation.
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const localId = room.localParticipant.identity;
        const agentIsSpeaking = speakers.some((p) => p.identity !== localId);
        setAgentSpeaking(agentIsSpeaking);
      });

      // Partial / still-being-recognized text -- updates live, never saved.
      room.registerTextStreamHandler("lk.live-partial", async (reader) => {
        let text = "";
        for await (const chunk of reader) text = chunk;
        setLiveText(text);
      });

      // Finalized sentence -- committed permanently to the log, exactly once.
      room.registerTextStreamHandler("lk.final-transcript", async (reader) => {
        let text = "";
        for await (const chunk of reader) text = chunk;
        setEntries((prev) => [
          ...prev,
          { id: nextIdRef.current++, text, ts: new Date() },
        ]);
        setLiveText("");
      });

      await room.connect(LIVEKIT_URL, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setPhase("live");
    } catch (err) {
      console.error("Connection failed:", err);
      setError(
        err.message === "Failed to fetch"
          ? "Can't reach the token server -- is the backend running on port 8000?"
          : err.message || "Connection failed."
      );
      setPhase("idle");
      roomRef.current = null;
    }
  };

  const handleConnectClick = () => {
    if (phase === "live") disconnect();
    else if (phase === "idle") connect();
  };

  const buttonLabel = { idle: "Connect", connecting: "Connecting\u2026", live: "Listening" }[phase];
  const statusLabel = agentSpeaking
    ? "Agent speaking\u2026"
    : {
        idle: "Not connected",
        connecting: "Opening voice channel\u2026",
        live: "Mic live -- describe what you're testing",
      }[phase];

  return (
    <div className={`app-shell${agentSpeaking ? " agent-speaking" : ""}`}>
      {/* Ambient background aura -- intensifies while the agent is speaking */}
      <div className="aura-field" aria-hidden="true">
        <div className="aura-ring ring-1" />
        <div className="aura-ring ring-2" />
        <div className="aura-ring ring-3" />
      </div>

      <header className="app-header">
        <div className="brand">
          <div className={`brand-orb${phase === "live" ? " is-live" : ""}${agentSpeaking ? " is-speaking" : ""}`} />
          <div>
            <h1>Voice PCB Copilot</h1>
            <p className="board-desc">
              {BOARD.name} &mdash; {BOARD.description}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={`connect-btn${phase === "live" ? " is-live" : ""}`}
          onClick={handleConnectClick}
          disabled={phase === "connecting"}
        >
          <span className="dot" />
          {buttonLabel}
        </button>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      <div className="app-main">
        <section className="console">
          <p className="panel-title">Debug session</p>
          <p className={`status-line${phase === "live" ? " live" : ""}${agentSpeaking ? " speaking" : ""}`}>
            <span className="dot" />
            {statusLabel}
          </p>

          <div className="transcript" ref={transcriptRef}>
            {entries.length === 0 && !liveText && (
              <p className="empty-state">
                Press Connect, then talk through what you're probing &mdash; e.g.
                "what's the expected voltage at TP3?"
              </p>
            )}
            {entries.map((entry) => (
              <div className="chat-row user" key={entry.id}>
                <span className="chat-avatar user-avatar">You</span>
                <div className="chat-bubble user-bubble">
                  <span className="ts">{entry.ts.toLocaleTimeString([], { hour12: false })}</span>
                  {entry.text}
                </div>
              </div>
            ))}
            {liveText && (
              <div className="chat-row user is-live">
                <span className="chat-avatar user-avatar">You</span>
                <div className="chat-bubble user-bubble live-partial">{liveText}</div>
              </div>
            )}
            {agentSpeaking && (
              <div className="chat-row agent">
                <span className="chat-avatar agent-avatar">AI</span>
                <div className="chat-bubble agent-bubble speaking-indicator">
                  <span className="bar" />
                  <span className="bar" />
                  <span className="bar" />
                  <span className="bar" />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="edge-connector">
        <div className="pins" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>
        <p className="stack">{"LiveKit \u2192 Deepgram STT \u2192 Groq LLM \u2192 Rime TTS"}</p>
      </footer>
    </div>
  );
}

export default App;