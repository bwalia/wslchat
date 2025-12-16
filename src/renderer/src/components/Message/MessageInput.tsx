import React, { useState, useCallback, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { sendMessage } from "../../store/slices/messageSlice";
import { useTypingIndicator } from "../../hooks/useSocketEvents";
import JoditEditor from "jodit-react";
import type { IJodit } from "jodit/esm/types/jodit";
import clsx from "clsx";
import AttachmentPreview, { type PendingAttachment } from "./AttachmentPreview";

interface MessageInputProps {
  channelUuid: string;
  parentMessageUuid?: string;
  placeholder?: string;
}

/**
 * Strips HTML tags and returns plain text content
 * Used to check if message has actual content
 */
const getTextContent = (html: string): string => {
  if (!html) return "";

  try {
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  } catch {
    return "";
  }
};

/**
 * Sanitizes HTML content for safe storage
 * Keeps only allowed formatting tags
 */
const sanitizeHtml = (html: string): string => {
  if (!html) return "";

  try {
    // If content is effectively empty, return empty string
    const textContent = getTextContent(html);
    if (!textContent) return "";

    // Clean up the HTML while keeping formatting
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p><p>/gi, "\n\n")
      .replace(/<p>/gi, "")
      .replace(/<\/p>/gi, "")
      .trim();
  } catch {
    return html;
  }
};

/**
 * Creates Jodit editor configuration
 * Separated to avoid recreation on every render
 */
const createEditorConfig = (
  isReadonly: boolean,
  placeholderText: string
): Record<string, unknown> => ({
  readonly: isReadonly,
  placeholder: placeholderText,
  toolbar: true,
  toolbarSticky: false,
  toolbarAdaptive: false,
  showCharsCounter: false,
  showWordsCounter: false,
  showXPathInStatusbar: false,
  statusbar: false,
  height: "auto",
  minHeight: 100,
  maxHeight: 250,
  autofocus: false,
  spellcheck: true,
  askBeforePasteHTML: false,
  askBeforePasteFromWord: false,
  defaultActionOnPaste: "insert_clear_html",
  enter: "br",
  tabIndex: 0,
  hidePoweredByJodit: true,
  // Slack-style formatting buttons
  buttons: [
    "bold",
    "italic",
    "underline",
    "strikethrough",
    "|",
    "ul",
    "ol",
    "|",
    "link",
  ],
  buttonsMD: ["bold", "italic", "underline", "|", "ul", "ol", "|", "link"],
  buttonsSM: ["bold", "italic", "|", "link"],
  buttonsXS: ["bold", "italic", "link"],
  // Disable features not needed for chat
  disablePlugins: [
    "add-new-line",
    "image",
    "image-processor",
    "image-properties",
    "video",
    "file",
    "table",
    "table-keyboard-navigation",
    "iframe",
    "hr",
    "fullsize",
    "print",
    "preview",
    "about",
    "copyformat",
    "symbols",
    "indent",
    "sticky",
    "superscript",
    "subscript",
    "class-span",
    "font",
    "fontsize",
    "brush",
    "redo-undo",
    "xpath",
    "stat",
    "search",
    "mobile",
    "speech-recognize",
    "powered-by-jodit",
    "source",
  ],
  // Allow only essential HTML
  allowResizeX: false,
  allowResizeY: false,
  // Clean pasted content
  cleanHTML: {
    fillEmptyParagraph: false,
    removeEmptyElements: true,
    replaceNBSP: true,
  },
  // Link settings - use correct type
  link: {
    openInNewTabCheckbox: false,
    noFollowCheckbox: false,
  },
  // Styling
  style: {
    font: '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
});

const MessageInput: React.FC<MessageInputProps> = ({
  channelUuid,
  parentMessageUuid,
  placeholder,
}) => {
  const dispatch = useAppDispatch();
  const { isSending } = useAppSelector((state) => state.message);
  const { currentChannel } = useAppSelector((state) => state.channel);
  const editorRef = useRef<IJodit | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const sendTyping = useTypingIndicator(channelUuid);

  const channelName = currentChannel?.name || "channel";
  const defaultPlaceholder = parentMessageUuid
    ? "Reply in thread..."
    : `Message #${channelName}`;

  // Check if content has actual text or attachments
  const hasContent = useMemo(() => {
    const hasText = getTextContent(content).length > 0;
    const hasAttachments = attachments.some((a) => a.uploaded);
    return hasText || hasAttachments;
  }, [content, attachments]);

  // Generate unique ID for attachments
  const generateId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    []
  );

  // Upload attachments to server
  const uploadAttachments = useCallback(
    async (attachmentsToUpload: PendingAttachment[]) => {
      console.log(
        "[MessageInput] uploadAttachments called with:",
        attachmentsToUpload.length,
        "files"
      );

      if (!attachmentsToUpload.length) {
        console.log("[MessageInput] No attachments to upload");
        return;
      }

      setIsUploading(true);

      for (const attachment of attachmentsToUpload) {
        console.log(
          "[MessageInput] Uploading:",
          attachment.name,
          "path:",
          attachment.path
        );

        // Mark as uploading
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachment.id ? { ...a, uploading: true } : a
          )
        );

        try {
          console.log(
            "[MessageInput] Calling files:upload-attachment IPC with:",
            {
              filePath: attachment.path,
              channelUuid,
            }
          );

          const result = await window.electronAPI.invoke<{
            file_name: string;
            file_type: string;
            file_size: number;
            file_url: string;
            key?: string;
          }>("files:upload-attachment", {
            filePath: attachment.path,
            channelUuid,
          });

          console.log("[MessageInput] Upload result:", result);

          if (result.success && result.data) {
            console.log("[MessageInput] Upload successful:", result.data);
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === attachment.id
                  ? {
                      ...a,
                      uploading: false,
                      uploaded: true,
                      uploadedData: result.data,
                    }
                  : a
              )
            );
          } else {
            console.error("[MessageInput] Upload failed:", result.error);
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === attachment.id
                  ? {
                      ...a,
                      uploading: false,
                      error: result.error || "Upload failed",
                    }
                  : a
              )
            );
          }
        } catch (error: any) {
          console.error("[MessageInput] Upload catch error:", error);
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id
                ? {
                    ...a,
                    uploading: false,
                    error: error.message || "Upload failed",
                  }
                : a
            )
          );
        }
      }

      setIsUploading(false);
      console.log("[MessageInput] Upload process completed");
    },
    [channelUuid]
  );

  // Handle file selection via native dialog
  const handleAttachClick = useCallback(async () => {
    console.log("[MessageInput] handleAttachClick called");
    try {
      console.log("[MessageInput] Calling files:select IPC");
      const result = await window.electronAPI.invoke<{
        files: Array<{
          path: string;
          name: string;
          size: number;
          type: string;
        }>;
      }>("files:select", { multiple: true });

      console.log("[MessageInput] files:select result:", result);

      if (!result.success || !result.data?.files?.length) {
        console.log("[MessageInput] No files selected or selection failed");
        return;
      }

      console.log("[MessageInput] Files selected:", result.data.files);

      const newAttachments: PendingAttachment[] = result.data.files.map(
        (file) => ({
          id: generateId(),
          path: file.path,
          name: file.name,
          size: file.size,
          type: file.type,
          preview: file.type.startsWith("image/")
            ? `file://${file.path}`
            : undefined,
          uploading: false,
          uploaded: false,
        })
      );

      console.log("[MessageInput] Created attachments:", newAttachments);

      setAttachments((prev) => [...prev, ...newAttachments]);

      // Auto-upload the new attachments
      console.log("[MessageInput] Starting auto-upload");
      uploadAttachments(newAttachments);
    } catch (error) {
      console.error("[MessageInput] Error selecting files:", error);
    }
  }, [generateId, uploadAttachments]);

  // Handle hidden file input change (fallback)
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;

      const newAttachments: PendingAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const attachment: PendingAttachment = {
          id: generateId(),
          name: file.name,
          size: file.size,
          type: file.type,
          uploading: false,
          uploaded: false,
        };

        // Create preview for images
        if (file.type.startsWith("image/")) {
          attachment.preview = URL.createObjectURL(file);
        }

        newAttachments.push(attachment);
      }

      setAttachments((prev) => [...prev, ...newAttachments]);

      // Reset file input
      e.target.value = "";

      // Note: For file input uploads, we don't have file paths so we can't use the main process upload
      // This would need a different approach using FileReader to send buffer data
    },
    [generateId]
  );

  // Remove attachment
  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((a) => a.id === id);
      // Revoke object URL if exists
      if (attachment?.preview && attachment.preview.startsWith("blob:")) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // Handle drag and drop
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (!files?.length) return;

      const newAttachments: PendingAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Get the file path from the File object (Electron provides this)
        const filePath = (file as any).path;

        const attachment: PendingAttachment = {
          id: generateId(),
          path: filePath,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          uploading: false,
          uploaded: false,
        };

        // Create preview for images
        if (file.type.startsWith("image/")) {
          attachment.preview = filePath
            ? `file://${filePath}`
            : URL.createObjectURL(file);
        }

        newAttachments.push(attachment);
      }

      setAttachments((prev) => [...prev, ...newAttachments]);

      // Upload attachments that have file paths
      const uploadableAttachments = newAttachments.filter((a) => a.path);
      if (uploadableAttachments.length > 0) {
        uploadAttachments(uploadableAttachments);
      }
    },
    [generateId, uploadAttachments]
  );

  // Jodit configuration - memoized to prevent unnecessary re-renders
  const editorConfig = useMemo(
    () => createEditorConfig(isSending, placeholder || defaultPlaceholder),
    [isSending, placeholder, defaultPlaceholder]
  );

  // Handle content changes with error boundary
  const handleChange = useCallback(
    (newContent: string) => {
      try {
        setContent(newContent || "");
        sendTyping(true);
      } catch (error) {
        console.error("[MessageInput] Error handling content change:", error);
      }
    },
    [sendTyping]
  );

  // Handle message submission with proper error handling
  const handleSubmit = useCallback(async () => {
    try {
      const textContent = getTextContent(content);
      const uploadedAttachments = attachments.filter(
        (a) => a.uploaded && a.uploadedData
      );

      // Require either text content or uploaded attachments
      if (
        (!textContent && uploadedAttachments.length === 0) ||
        isSending ||
        isUploading
      )
        return;

      sendTyping(false);

      // Determine content type based on HTML presence
      const hasHtmlFormatting =
        /<(b|i|u|s|strong|em|a|ul|ol|li|code|pre)[^>]*>/i.test(content);
      const contentType = hasHtmlFormatting ? "markdown" : "text";
      const messageContent = hasHtmlFormatting
        ? sanitizeHtml(content)
        : textContent;

      // Prepare attachments for message
      const messageAttachments = uploadedAttachments.map((a) => ({
        file_name: a.uploadedData!.file_name,
        file_type: a.uploadedData!.file_type,
        file_size: a.uploadedData!.file_size,
        file_url: a.uploadedData!.file_url,
      }));

      await dispatch(
        sendMessage({
          channelUuid,
          content: messageContent || "",
          contentType,
          parentMessageUuid,
          attachments:
            messageAttachments.length > 0 ? messageAttachments : undefined,
        })
      );

      // Clear content after successful send
      setContent("");
      setAttachments([]);

      // Clear editor content if ref is available
      if (editorRef.current) {
        editorRef.current.value = "";
      }
    } catch (error) {
      console.error("[MessageInput] Error sending message:", error);
    }
  }, [
    content,
    attachments,
    isSending,
    isUploading,
    sendTyping,
    dispatch,
    channelUuid,
    parentMessageUuid,
  ]);

  // Handle keyboard events with error boundary
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      try {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      } catch (error) {
        console.error("[MessageInput] Error handling keydown:", error);
      }
    },
    [handleSubmit]
  );

  return (
    <div
      className={clsx("message-input-container", isDragging && "drag-active")}
      onKeyDown={handleKeyDown}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-overlay-content">
            <svg
              className="w-12 h-12 text-primary-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-lg font-medium text-secondary-700 dark:text-secondary-200">
              Drop files here to upload
            </span>
          </div>
        </div>
      )}

      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <AttachmentPreview
          attachments={attachments}
          onRemove={handleRemoveAttachment}
          isUploading={isUploading}
        />
      )}

      {/* Rich Text Editor */}
      <div className="jodit-chat-editor">
        <JoditEditor
          ref={editorRef as React.RefObject<IJodit>}
          value={content}
          config={editorConfig}
          onBlur={handleChange}
          onChange={handleChange}
        />
      </div>

      {/* Hidden file input for fallback */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
      />

      {/* Bottom Toolbar */}
      <div className="message-input-toolbar">
        <div className="message-input-actions">
          {/* Attach File */}
          <button
            className="message-input-action-btn"
            title="Attach file"
            type="button"
            onClick={handleAttachClick}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>

          {/* Emoji */}
          <button
            className="message-input-action-btn"
            title="Add emoji"
            type="button"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {/* Mention */}
          <button
            className="message-input-action-btn"
            title="Mention someone"
            type="button"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
              />
            </svg>
          </button>

          {/* GIF */}
          <button
            className="message-input-action-btn"
            title="Add GIF"
            type="button"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Keyboard hint */}
          <span className="keyboard-hint">
            <kbd>Enter</kbd>
            <span>to send</span>
          </span>

          {/* Send Button */}
          <button
            onClick={handleSubmit}
            disabled={!hasContent || isSending || isUploading}
            type="button"
            className={clsx(
              "message-send-btn",
              hasContent && !isSending && !isUploading ? "active" : "disabled"
            )}
            title={isUploading ? "Uploading files..." : "Send message (Enter)"}
          >
            {isSending || isUploading ? (
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
