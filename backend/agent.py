import asyncio
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentServer, Agent, AgentSession, room_io
from livekit.plugins import deepgram

load_dotenv()

server = AgentServer()


@server.rtc_session(agent_name="pcb-copilot")
async def my_agent(ctx: agents.JobContext):

    session = AgentSession(
        stt=deepgram.STT(
            model="nova-3",
            language="en",
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
            instructions="Transcribe the user's speech to text."
        ),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            text_output=room_io.TextOutputOptions(
                sync_transcription=False
            )
        ),
    )


if __name__ == "__main__":
    agents.cli.run_app(server)