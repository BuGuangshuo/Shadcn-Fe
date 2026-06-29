import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

type MarkdownContentProps = {
  content: string
  className?: string
}

function getTextContent(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children)
  }

  if (Array.isArray(children)) {
    return children.map(getTextContent).join("")
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return getTextContent(children.props.children)
  }

  return ""
}

function isElementWithClassName(
  node: React.ReactNode
): node is React.ReactElement<{ className?: string }> {
  return React.isValidElement<{ className?: string }>(node)
}

function getCodeLanguage(children: React.ReactNode) {
  const codeElement = React.Children.toArray(children).find(
    isElementWithClassName
  )
  const className = codeElement?.props.className
    ? String(codeElement.props.className)
    : ""

  return /language-(\S+)/.exec(className)?.[1]
}

function CodeBlock({
  children,
  code,
  language,
}: {
  children: React.ReactNode
  code: string
  language?: string
}) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) {
      return
    }

    const timeout = window.setTimeout(() => setCopied(false), 1600)

    return () => window.clearTimeout(timeout)
  }, [copied])

  async function handleCopy() {
    if (!navigator.clipboard) {
      return
    }

    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border bg-muted/30 text-card-foreground">
      <div className="flex min-h-9 items-center justify-between gap-3 border-b bg-muted/50 px-3 py-1.5">
        <span className="truncate font-mono text-xs text-muted-foreground">
          {language || "代码"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="-me-1"
          onClick={handleCopy}
        >
          {copied ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <CopyIcon data-icon="inline-start" />
          )}
          {copied ? "已复制" : "复制"}
        </Button>
      </div>
      {children}
    </div>
  )
}

const markdownComponents = {
  h1({ node: _node, className, ...props }) {
    void _node
    return (
      <h1
        className={cn("mt-5 mb-2 text-xl leading-7 font-semibold", className)}
        {...props}
      />
    )
  },
  h2({ node: _node, className, ...props }) {
    void _node
    return (
      <h2
        className={cn("mt-5 mb-2 text-lg leading-7 font-semibold", className)}
        {...props}
      />
    )
  },
  h3({ node: _node, className, ...props }) {
    void _node
    return (
      <h3
        className={cn("mt-4 mb-2 text-base leading-6 font-semibold", className)}
        {...props}
      />
    )
  },
  h4({ node: _node, className, ...props }) {
    void _node
    return (
      <h4
        className={cn("mt-4 mb-2 text-sm leading-6 font-semibold", className)}
        {...props}
      />
    )
  },
  p({ node: _node, className, ...props }) {
    void _node
    return (
      <p
        className={cn(
          "my-2 leading-6 break-words first:mt-0 last:mb-0",
          className
        )}
        {...props}
      />
    )
  },
  a({ node: _node, className, ...props }) {
    void _node
    return (
      <a
        target="_blank"
        rel="noreferrer"
        className={cn(
          "font-medium text-primary underline underline-offset-4 hover:text-primary/80",
          className
        )}
        {...props}
      />
    )
  },
  ul({ node: _node, className, ...props }) {
    void _node
    return <ul className={cn("my-3 list-disc ps-5", className)} {...props} />
  },
  ol({ node: _node, className, ...props }) {
    void _node
    return <ol className={cn("my-3 list-decimal ps-5", className)} {...props} />
  },
  li({ node: _node, className, ...props }) {
    void _node
    return <li className={cn("my-1 ps-1 leading-6", className)} {...props} />
  },
  blockquote({ node: _node, className, ...props }) {
    void _node
    return (
      <blockquote
        className={cn(
          "my-3 border-s-4 border-border bg-muted/30 py-2 ps-3 text-muted-foreground",
          className
        )}
        {...props}
      />
    )
  },
  hr({ node: _node, className, ...props }) {
    void _node
    return <hr className={cn("my-4 border-border", className)} {...props} />
  },
  table({ node: _node, className, ...props }) {
    void _node
    return (
      <div className="my-3 overflow-x-auto rounded-lg border">
        <table
          className={cn("w-full border-collapse text-left text-sm", className)}
          {...props}
        />
      </div>
    )
  },
  th({ node: _node, className, ...props }) {
    void _node
    return (
      <th
        className={cn(
          "border-b bg-muted/50 px-3 py-2 font-medium text-foreground",
          className
        )}
        {...props}
      />
    )
  },
  td({ node: _node, className, ...props }) {
    void _node
    return (
      <td
        className={cn("border-b px-3 py-2 align-top", className)}
        {...props}
      />
    )
  },
  code({ node: _node, className, children, ...props }) {
    void _node
    const codeText = getTextContent(children)
    const isBlockCode =
      className?.includes("language-") || codeText.includes("\n")

    return (
      <code
        className={cn(
          isBlockCode
            ? "block min-w-full bg-transparent px-4 py-3 font-mono text-[0.8125rem] leading-6"
            : "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.8125em]",
          className
        )}
        {...props}
      >
        {children}
      </code>
    )
  },
  pre({ node: _node, className, children, ...props }) {
    void _node
    const code = getTextContent(children).replace(/\n$/, "")

    return (
      <CodeBlock code={code} language={getCodeLanguage(children)}>
        <pre
          className={cn("overflow-x-auto bg-transparent", className)}
          {...props}
        >
          {children}
        </pre>
      </CodeBlock>
    )
  },
} satisfies Components

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn("max-w-none min-w-0 break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        skipHtml
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
