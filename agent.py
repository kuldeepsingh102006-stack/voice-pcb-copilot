from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentServer, AgentSession, inference

load_dotenv()

server = AgentServer()


@server.rtc_session(agent_name="pcb-copilot")
async def my_agent(ctx: agents.JobContext):

    session = AgentSession(
        stt=inference.STT(
            model="deepgram/nova-3",
            language="en-IN",
        )
    )

    await session.start(
        room=ctx.room,
        agent=agents.Agent(
            instructions="You are a PCB voice assistant."
        ),
    )


if __name__ == "__main__":
    agents.cli.run_app(server)