type JsonRpcMessage = {
  jsonrpc?: string
  id?: number | string | null
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code: number; message: string }
}

export type RpcHandler = (message: JsonRpcMessage) => Promise<JsonRpcMessage | null>

/**
 * In-memory MCP transport — bypassa a rede, chamando um handler local.
 * Compatível com a interface MCPTransport do @ai-sdk/mcp.
 */
export class InMemoryMCPTransport {
  // callbacks AI SDK pluga
  onclose?: () => void
  onerror?: (err: Error) => void
  onmessage?: (message: JsonRpcMessage) => void

  private closed = false

  constructor(private readonly handler: RpcHandler) {}

  async start(): Promise<void> {
    // No-op: handler está pronto
  }

  async send(message: JsonRpcMessage): Promise<void> {
    if (this.closed) throw new Error("transport closed")
    try {
      const response = await this.handler(message)
      if (response && this.onmessage) {
        // Entrega assíncrona pra respeitar a semântica send → onmessage
        queueMicrotask(() => {
          if (!this.closed && this.onmessage) this.onmessage(response)
        })
      }
    } catch (err) {
      if (this.onerror) {
        this.onerror(err instanceof Error ? err : new Error(String(err)))
      } else {
        throw err
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true
    this.onclose?.()
  }

  // Métodos opcionais da spec, não usados aqui
  setProtocolVersion?(_: string): void {}
}
