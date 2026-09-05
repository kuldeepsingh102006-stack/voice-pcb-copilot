from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentServer, Agent, AgentSession, inference, room_io

load_dotenv()

server = AgentServer()


@server.rtc_session(agent_name="pcb-copilot")
async def my_agent(ctx: agents.JobContext):

    session = AgentSession(
        stt=inference.STT(
    model="deepgram/nova-3",
    language="en-IN",
    endpointing_ms=100,
),
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