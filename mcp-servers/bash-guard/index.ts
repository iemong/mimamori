import { loadBashWhitelist, isWhitelisted } from "../../src/bash-guard";

const HITL_BRIDGE_PORT = process.env.AIPM_HITL_BRIDGE_PORT || "3456";
const HITL_BRIDGE_URL = `http://localhost:${HITL_BRIDGE_PORT}`;

// --------------------------------------------------
// MCP Protocol (JSON-RPC 2.0 over stdio)
// --------------------------------------------------

function send(message: object) {
  const json = JSON.stringify(message);
  process.stdout.write(json + "\n");
}

function sendResult(id: number | string, result: unknown) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(
  id: number | string,
  code: number,
  message: string,
) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

// --------------------------------------------------
// Tool definition
// --------------------------------------------------

const TOOL_DEF = {
  name: "execute_command",
  description:
    "シェルコマンドを実行します。ホワイトリストにないコマンドはユーザーの承認が必要です。",
  inputSchema: {
    type: "object" as const,
    properties: {
      command: {
        type: "string",
        description: "実行するシェルコマンド",
      },
    },
    required: ["command"],
  },
};

// --------------------------------------------------
// Command execution
// --------------------------------------------------

async function executeCommand(
  command: string,
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  try {
    const proc = Bun.spawn(["sh", "-c", command], {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    const parts = [];
    if (stdout) parts.push(stdout);
    if (stderr) parts.push(`stderr:\n${stderr}`);
    parts.push(`(exit code: ${exitCode})`);

    return {
      content: [{ type: "text", text: parts.join("\n") }],
      isError: exitCode !== 0,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `実行エラー: ${error}` }],
      isError: true,
    };
  }
}

// --------------------------------------------------
// HITL approval
// --------------------------------------------------

async function requestApproval(command: string): Promise<boolean> {
  try {
    const res = await fetch(`${HITL_BRIDGE_URL}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    const data = (await res.json()) as { approved: boolean };
    return data.approved;
  } catch {
    // Bridge unreachable → deny for safety
    return false;
  }
}

// --------------------------------------------------
// Message handler
// --------------------------------------------------

async function handleMessage(msg: {
  jsonrpc: string;
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}) {
  switch (msg.method) {
    case "initialize":
      sendResult(msg.id!, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "aipm-bash-guard", version: "0.1.0" },
      });
      break;

    case "notifications/initialized":
      // notification — no response
      break;

    case "tools/list":
      sendResult(msg.id!, { tools: [TOOL_DEF] });
      break;

    case "tools/call": {
      const params = msg.params as {
        name: string;
        arguments: { command: string };
      };

      if (params.name !== "execute_command") {
        sendError(msg.id!, -32601, `Unknown tool: ${params.name}`);
        break;
      }

      const command = params.arguments.command;

      if (isWhitelisted(command)) {
        const result = await executeCommand(command);
        sendResult(msg.id!, result);
      } else {
        const approved = await requestApproval(command);
        if (approved) {
          const result = await executeCommand(command);
          sendResult(msg.id!, result);
        } else {
          sendResult(msg.id!, {
            content: [
              {
                type: "text",
                text: `コマンドが拒否されました: ${command}`,
              },
            ],
          });
        }
      }
      break;
    }

    default:
      if (msg.id != null) {
        sendError(msg.id, -32601, `Unknown method: ${msg.method}`);
      }
  }
}

// --------------------------------------------------
// stdio reader
// --------------------------------------------------

async function main() {
  await loadBashWhitelist();

  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) {
        try {
          const message = JSON.parse(line);
          await handleMessage(message);
        } catch (e) {
          console.error("[bash-guard] Parse error:", e);
        }
      }
    }
  }
}

main().catch((err) => {
  console.error("[bash-guard] Fatal:", err);
  process.exit(1);
});
