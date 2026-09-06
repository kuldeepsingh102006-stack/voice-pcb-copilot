import asyncio
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentServer, Agent, AgentSession, TurnHandlingOptions, room_io
from livekit.plugins import deepgram, groq, rime
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv()

server = AgentServer()


@server.rtc_session(agent_name="pcb-copilot")
async def my_agent(ctx: agents.JobContext):

    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="multi",  # lets Deepgram auto-detect/switch between languages
        ),
        lllm=groq.LLM(
        model="openai/gpt-oss-20b",
        max_completion_tokens=60,
        ),
        tts=rime.TTS(
            model="coda",
            speaker="lyra",
            use_websocket=True,
              segment="bySentence",
        ),
            turn_handling=TurnHandlingOptions(
                 turn_detection=MultilingualModel(),   # runs locally, no cloud round-trip
             ),

    )

    @session.on("user_input_transcribed")
    def on_transcript(ev):
        topic = "lk.final-transcript" if ev.is_final else "lk.live-partial"
        asyncio.create_task(
            ctx.room.local_participant.send_text(ev.transcript, topic=topic)
        )

    await session.start(
        agent=Agent(
            instructions=(
                "You are a hands-free voice assistant helping an engineer debug "
                "a PCB. Keep answers short and spoken-friendly — one or two "
                "sentences, no bullet points, no long lists. You don't have any "
                "PCB-specific knowledge loaded yet, so if asked about a specific "
                "component, be honest that you don't have that data yet."
            )
        ),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            text_output=room_io.TextOutputOptions(
                sync_transcription=False
            )
        ),
    )
    await session.generate_reply(
        instructions="Greet the user briefly and ask what they're debugging today."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)