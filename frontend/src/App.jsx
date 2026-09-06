import { useState } from "react";
import { Room, RoomEvent } from "livekit-client";

function App() {
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState("");
  const [liveText, setLiveText] = useState("");

  const connectToRoom = async () => {
    try {
      // Get token from backend
      const response = await fetch("http://127.0.0.1:8000/token");
      const data = await response.json();

      const room = new Room();

      room.on(RoomEvent.Connected, () => {
        console.log("Connected to LiveKit!");
        setConnected(true);
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log("Disconnected from LiveKit");
        setConnected(false);
      });

      // Play the agent's voice — without this, audio silently never plays
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "audio") {
          const audioElement = track.attach();
          document.body.appendChild(audioElement);
        }
      });
      
      // Partial / still-being-recognized text — updates live, never saved permanently
      room.registerTextStreamHandler("lk.live-partial", async (reader) => {
        let text = "";
        for await (const chunk of reader) {
          text = chunk;
          console.log("PARTIAL:", text);
        }
        setLiveText(text);
      });

      // Finalized sentence — committed permanently to history, exactly once
      room.registerTextStreamHandler("lk.final-transcript", async (reader) => {
        let text = "";
        for await (const chunk of reader) {
          text = chunk;
        }
        console.log("FINAL:", text);
        setHistory((prev) => (prev ? prev + " " + text : text));
        setLiveText("");
      });

      // Connect to LiveKit
      await room.connect(
        "wss://pcb-design-jdags579.livekit.cloud",
        data.token
      );

      // Turn microphone on
      await room.localParticipant.setMicrophoneEnabled(true);

      console.log("Microphone enabled!");
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  return (
    <div>
      <h1>Voice PCB Copilot</h1>

      <button onClick={connectToRoom}>
        {connected ? "Connected" : "Connect"}
      </button>

      <p>
        {connected
          ? "Connected — microphone is ON 🎤"
          : "Not connected"}
      </p>

      <h2>Live Transcript</h2>

      <div>
        {history} <span style={{ opacity: 0.6 }}>{liveText}</span>
        {!history && !liveText && "Start speaking..."}
      </div>
    </div>
  );
}

export default App;