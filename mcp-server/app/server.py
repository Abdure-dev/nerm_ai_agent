from mcp.server.fastmcp import FastMCP

mcp = FastMCP("NERM MCP Server")


@mcp.tool()
async def health_check() -> dict[str, str]:
    """Return the current status of the NERM MCP server."""
    return {"status": "ok", "service": "nerm-mcp-server"}


@mcp.tool()
async def get_my_pending_items() -> list[dict[str, str]]:
    """Return mock pending NERM items for the current user."""
    return [
        {
            "id": "pending-001",
            "type": "Profile review",
            "status": "Pending",
        }
    ]


if __name__ == "__main__":
    mcp.run()
