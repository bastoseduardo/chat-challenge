"use client"

import { isValidElement, useRef, useState, type ReactNode } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

const LANGUAGE_NAMES: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  py: "Python",
  python: "Python",
  sql: "SQL",
  bash: "Bash",
  sh: "Shell",
  shell: "Shell",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  yaml: "YAML",
  yml: "YAML",
  go: "Go",
  rust: "Rust",
  java: "Java",
  md: "Markdown",
  markdown: "Markdown",
}

function languageOf(children: ReactNode): string | null {
  if (!isValidElement<{ className?: string }>(children)) return null
  const match = /language-([\w-]+)/.exec(children.props.className ?? "")
  if (!match) return null
  return LANGUAGE_NAMES[match[1].toLowerCase()] ?? match[1]
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const language = languageOf(children)

  async function copy() {
    const text = preRef.current?.innerText ?? ""
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="code-block">
      <div className="code-block-bar">
        <span>{language ?? "Código"}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 hover:bg-accent hover:text-foreground transition-colors pointer-coarse:py-2"
          aria-label={copied ? "Código copiado" : "Copiar código"}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre ref={preRef}>{children}</pre>
    </div>
  )
}

const components: Components = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  // Tabelas rolam na horizontal (CSS); tabIndex deixa a rolagem acessível pelo teclado.
  table: ({ children }) => <table tabIndex={0}>{children}</table>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
}

export function Markdown({ text, reading }: { text: string; reading?: boolean }) {
  return (
    <div className={cn("markdown", reading && "markdown-reading")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
