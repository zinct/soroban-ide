import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

const resolveImageSrc = (src, markdownPath, fileContents) => {
  if (!src) return src;
  if (src.startsWith("data:") || src.startsWith("http:") || src.startsWith("https:")) {
    return src;
  }

  let decodedSrc = src;
  try {
    decodedSrc = decodeURIComponent(src);
  } catch (e) {
    // Ignore URI error, fallback to raw src
  }

  // Normalize path by stripping leading ./ or /
  let normalizedPath = decodedSrc;
  if (normalizedPath.startsWith("./")) {
    normalizedPath = normalizedPath.substring(2);
  } else if (normalizedPath.startsWith("/")) {
    normalizedPath = normalizedPath.substring(1);
  }

  // Try to resolve path relative to current markdown file
  let targetFileId = normalizedPath;
  if (markdownPath && markdownPath.includes("/")) {
    const dir = markdownPath.substring(0, markdownPath.lastIndexOf("/"));
    targetFileId = `${dir}/${normalizedPath}`;
  }

  // Check if target file exists in fileContents
  const content = fileContents[targetFileId];
  if (content) {
    const ext = targetFileId.split(".").pop()?.toLowerCase() || "png";
    const mimeType = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
    return `data:${mimeType};base64,${content}`;
  }

  // Fallback: search fileContents by file name match
  const filename = normalizedPath.split("/").pop();
  const foundKey = Object.keys(fileContents).find(
    (key) => key.endsWith(`/${filename}`) || key === filename
  );
  if (foundKey) {
    const content = fileContents[foundKey];
    const ext = foundKey.split(".").pop()?.toLowerCase() || "png";
    const mimeType = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
    return `data:${mimeType};base64,${content}`;
  }

  return src;
};

const preprocessMarkdown = (markdown) => {
  if (!markdown) return "";
  return markdown.replace(/(!?\[[^\]]*\])\(([^)]+)\)/g, (match, label, url) => {
    if (url.includes(" ")) {
      return `${label}(${encodeURI(url)})`;
    }
    return match;
  });
};

const MarkdownPreview = ({ content = "", filePath = "", fileContents = {}, theme = "dark" }) => {
  const processedContent = useMemo(() => preprocessMarkdown(content), [content]);

  const components = useMemo(
    () => ({
      img: ({ src, alt, ...props }) => {
        const resolvedSrc = resolveImageSrc(src, filePath, fileContents);
        return <img src={resolvedSrc} alt={alt} {...props} />;
      },
      code: ({ className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || "");
        const codeText = String(children).replace(/\n$/, "");
        
        // Inline code (no newline and no language match)
        const isInline = !match && !codeText.includes("\n");

        if (isInline) {
          return (
            <code className="markdown-inline-code" {...props}>
              {children}
            </code>
          );
        }

        return (
          <div className="markdown-code-block">
            <div className="markdown-code-block-header">
              <span>{match ? match[1] : "code"}</span>
            </div>
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={match ? match[1] : "javascript"}
              PreTag="div"
              className="markdown-syntax-highlighter"
              {...props}
            >
              {codeText}
            </SyntaxHighlighter>
          </div>
        );
      },
    }),
    [filePath, fileContents]
  );

  return (
    <div className="markdown-preview" data-theme={theme}>
      <div className="markdown-preview-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {processedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MarkdownPreview;
