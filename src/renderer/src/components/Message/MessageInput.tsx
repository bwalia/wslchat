import React, { useState, useCallback, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { sendMessage } from "../../store/slices/messageSlice";
import { useTypingIndicator } from "../../hooks/useSocketEvents";
import JoditEditor from "jodit-react";
import type { IJodit } from "jodit/esm/types/jodit";
import clsx from "clsx";
import AttachmentPreview, { type PendingAttachment } from "./AttachmentPreview";
import MentionAutocomplete from "./MentionAutocomplete";
import type { MentionableUser, SpecialMention } from "../../types";

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

// Interface for mention state
interface MentionState {
  isVisible: boolean;
  searchTerm: string;
  position: { top: number; left: number };
  triggerIndex: number; // Position of @ in the text
}

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
  const containerRef = useRef<HTMLDivElement>(null);

  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const sendTyping = useTypingIndicator(channelUuid);

  // Mention autocomplete state
  const [mentionState, setMentionState] = useState<MentionState>({
    isVisible: false,
    searchTerm: "",
    position: { top: 0, left: 0 },
    triggerIndex: -1,
  });

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

  // Type definitions for upload responses
  interface UploadedFileData {
    file_name: string;
    file_type: string;
    file_size: number;
    file_url: string;
    key?: string;
  }

  interface UploadSuccessResult {
    success: true;
    data: UploadedFileData;
    error?: undefined;
  }

  interface UploadErrorResult {
    success: false;
    error: string;
    data?: undefined;
  }

  type UploadResult = UploadSuccessResult | UploadErrorResult;

  // Upload a single attachment (path-based for native file selection)
  const uploadAttachmentByPath = useCallback(
    async (attachment: PendingAttachment): Promise<UploadResult> => {
      const result = await window.electronAPI.invoke<UploadedFileData>(
        "files:upload-attachment",
        {
          filePath: attachment.path,
          channelUuid,
        }
      );

      if (result.success && result.data) {
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error || "Upload failed" };
    },
    [channelUuid]
  );

  // Upload a single attachment (buffer-based for drag & drop)
  const uploadAttachmentByBuffer = useCallback(
    async (attachment: PendingAttachment): Promise<UploadResult> => {
      if (!attachment.file) {
        return { success: false, error: "No file data available" };
      }

      // Read file as ArrayBuffer
      const arrayBuffer = await attachment.file.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));

      const result = await window.electronAPI.invoke<UploadedFileData>(
        "files:upload-buffer",
        {
          buffer,
          fileName: attachment.name,
          channelUuid,
        }
      );

      if (result.success && result.data) {
        return { success: true, data: result.data };
      }
      return { success: false, error: result.error || "Upload failed" };
    },
    [channelUuid]
  );

  // Upload attachments to server
  const uploadAttachments = useCallback(
    async (attachmentsToUpload: PendingAttachment[]): Promise<void> => {
      if (!attachmentsToUpload.length) {
        return;
      }

      setIsUploading(true);

      for (const attachment of attachmentsToUpload) {
        // Mark as uploading
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachment.id ? { ...a, uploading: true } : a
          )
        );

        try {
          let result: UploadResult;

          // Use path-based upload if path is available (native file dialog)
          // Otherwise use buffer-based upload (drag & drop in sandbox mode)
          if (attachment.path) {
            result = await uploadAttachmentByPath(attachment);
          } else if (attachment.file) {
            result = await uploadAttachmentByBuffer(attachment);
          } else {
            result = { success: false, error: "No file path or data available" };
          }

          if (result.success) {
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
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === attachment.id
                  ? {
                      ...a,
                      uploading: false,
                      error: result.error,
                    }
                  : a
              )
            );
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Upload failed";
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id
                ? {
                    ...a,
                    uploading: false,
                    error: errorMessage,
                  }
                : a
            )
          );
        }
      }

      setIsUploading(false);
    },
    [uploadAttachmentByPath, uploadAttachmentByBuffer]
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

      console.log("[MessageInput] Drop detected, files:", files.length);

      const newAttachments: PendingAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Get the file path from the File object (Electron provides this in non-sandbox mode)
        const filePath = (file as any).path;

        console.log("[MessageInput] Processing dropped file:", file.name, "path:", filePath);

        const attachment: PendingAttachment = {
          id: generateId(),
          path: filePath, // May be undefined in sandbox mode
          file: file, // Store File object for buffer-based upload
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

      // Upload all attachments (uploadAttachments handles path vs buffer upload)
      if (newAttachments.length > 0) {
        console.log("[MessageInput] Starting upload for", newAttachments.length, "dropped files");
        uploadAttachments(newAttachments);
      }
    },
    [generateId, uploadAttachments]
  );

  // Jodit configuration - memoized to prevent unnecessary re-renders
  const editorConfig = useMemo(
    () => createEditorConfig(isSending, placeholder || defaultPlaceholder),
    [isSending, placeholder, defaultPlaceholder]
  );

  // Get cursor position in pixels for positioning autocomplete
  const getCursorPosition = useCallback((): { top: number; left: number } => {
    const editor = editorRef.current;
    if (!editor || !editor.selection) {
      return { top: 0, left: 0 };
    }

    try {
      const selection = editor.selection.sel;
      if (!selection || selection.rangeCount === 0) {
        return { top: 0, left: 0 };
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();

      if (containerRect) {
        return {
          top: containerRect.bottom - rect.bottom + 24,
          left: rect.left - containerRect.left,
        };
      }

      return { top: 0, left: rect.left };
    } catch {
      return { top: 0, left: 0 };
    }
  }, []);

  // Check for @ mention trigger in content
  const checkForMentionTrigger = useCallback(
    () => {
      const editor = editorRef.current;

      if (!editor || !editor.selection) {
        return;
      }

      try {
        const selection = editor.selection.sel;
        if (!selection || selection.rangeCount === 0) {
          return;
        }

        // Get current cursor position in text
        const range = selection.getRangeAt(0);
        const container = range.startContainer;
        const offset = range.startOffset;

        // Get text before cursor
        let textBeforeCursor = "";
        if (container.nodeType === Node.TEXT_NODE) {
          textBeforeCursor = container.textContent?.substring(0, offset) || "";
        }

        // Find the last @ symbol before cursor
        const lastAtIndex = textBeforeCursor.lastIndexOf("@");

        if (lastAtIndex !== -1) {
          // Check if @ is at start of word (preceded by space, newline, or at start)
          const charBefore = textBeforeCursor[lastAtIndex - 1];
          const isStartOfWord =
            lastAtIndex === 0 ||
            charBefore === " " ||
            charBefore === "\n" ||
            charBefore === "\t";

          if (isStartOfWord) {
            // Get the search term after @
            const searchTerm = textBeforeCursor.substring(lastAtIndex + 1);

            // Only show autocomplete if search term has no spaces
            if (!searchTerm.includes(" ")) {
              const position = getCursorPosition();
              setMentionState({
                isVisible: true,
                searchTerm,
                position,
                triggerIndex: lastAtIndex,
              });
              return;
            }
          }
        }

        // Hide autocomplete if no valid @ trigger found
        if (mentionState.isVisible) {
          setMentionState((prev) => ({ ...prev, isVisible: false }));
        }
      } catch (error) {
        console.error("[MessageInput] Error checking mention trigger:", error);
      }
    },
    [getCursorPosition, mentionState.isVisible]
  );

  // Handle mention selection from autocomplete
  const handleMentionSelect = useCallback(
    (mention: MentionableUser | SpecialMention) => {
      const editor = editorRef.current;
      if (!editor) {
        setMentionState((prev) => ({ ...prev, isVisible: false }));
        return;
      }

      try {
        // Determine the display text and data attributes
        const isSpecial = "display" in mention;
        const displayText = isSpecial
          ? mention.display
          : `@${mention.display_name || mention.username || "user"}`;
        const mentionId = isSpecial ? mention.id : mention.uuid;
        const mentionType = isSpecial ? mention.id : "user";

        // Get current selection
        const selection = editor.selection.sel;
        if (!selection || selection.rangeCount === 0) {
          setMentionState((prev) => ({ ...prev, isVisible: false }));
          return;
        }

        const range = selection.getRangeAt(0);
        const container = range.startContainer;
        const offset = range.startOffset;

        if (container.nodeType === Node.TEXT_NODE && container.textContent) {
          const text = container.textContent;
          const beforeAt = text.substring(0, offset);
          const lastAtIndex = beforeAt.lastIndexOf("@");

          if (lastAtIndex !== -1) {
            // Calculate text before @ and after cursor
            const textBefore = text.substring(0, lastAtIndex);
            const textAfter = text.substring(offset);

            // Create mention span element
            const mentionSpan = editor.createInside.element("span", {
              class: "mention-tag",
              "data-mention-id": mentionId,
              "data-mention-type": mentionType,
              contenteditable: "false",
            });
            mentionSpan.textContent = displayText;

            // Create space after mention
            const spaceNode = editor.createInside.text("\u00A0");

            // Replace the text node content
            const parentNode = container.parentNode;
            if (parentNode) {
              // Create new structure
              const fragment = document.createDocumentFragment();

              if (textBefore) {
                fragment.appendChild(document.createTextNode(textBefore));
              }
              fragment.appendChild(mentionSpan);
              fragment.appendChild(spaceNode);
              if (textAfter) {
                fragment.appendChild(document.createTextNode(textAfter));
              }

              // Replace the text node
              parentNode.replaceChild(fragment, container);

              // Move cursor after the space
              const newRange = document.createRange();
              newRange.setStartAfter(spaceNode);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);

              // Update content state
              setContent(editor.value);
            }
          }
        }
      } catch (error) {
        console.error("[MessageInput] Error inserting mention:", error);
      }

      // Close autocomplete
      setMentionState((prev) => ({ ...prev, isVisible: false }));
    },
    []
  );

  // Close mention autocomplete
  const handleMentionClose = useCallback(() => {
    setMentionState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  // Handle @ button click to open mention autocomplete
  const handleMentionButtonClick = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      // Insert @ at cursor position
      editor.selection.insertHTML("@");
      editor.selection.focus();

      // Trigger mention detection
      const position = getCursorPosition();
      setMentionState({
        isVisible: true,
        searchTerm: "",
        position,
        triggerIndex: -1,
      });
    } catch (error) {
      console.error("[MessageInput] Error opening mention:", error);
    }
  }, [getCursorPosition]);

  // Handle content changes with error boundary
  const handleChange = useCallback(
    (newContent: string) => {
      try {
        setContent(newContent || "");
        sendTyping(true);

        // Check for mention trigger
        checkForMentionTrigger();
      } catch (error) {
        console.error("[MessageInput] Error handling content change:", error);
      }
    },
    [sendTyping, checkForMentionTrigger]
  );


  // Extract mentions from HTML content
  const extractMentions = useCallback((html: string): Array<{ uuid: string; type: string }> => {
    const mentions: Array<{ uuid: string; type: string }> = [];
    const mentionRegex = /<span[^>]*data-mention-id="([^"]*)"[^>]*data-mention-type="([^"]*)"[^>]*>/g;

    let match;
    while ((match = mentionRegex.exec(html)) !== null) {
      const uuid = match[1];
      const type = match[2];
      // Avoid duplicates
      if (!mentions.some(m => m.uuid === uuid && m.type === type)) {
        mentions.push({ uuid, type });
      }
    }

    return mentions;
  }, []);

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

      // Extract mentions from content
      const mentions = extractMentions(content);

      // Determine content type based on HTML presence (including mentions)
      const hasHtmlFormatting =
        /<(b|i|u|s|strong|em|a|ul|ol|li|code|pre|span)[^>]*>/i.test(content);
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
          mentions: mentions.length > 0 ? mentions : undefined,
        })
      );

      // Clear content after successful send
      setContent("");
      setAttachments([]);

      // Clear editor content safely using Jodit API
      if (editorRef.current) {
        try {
          // Use setEditorValue for safe value update
          if (typeof editorRef.current.setEditorValue === "function") {
            editorRef.current.setEditorValue("");
          } else if (editorRef.current.editor) {
            // Fallback: clear via innerHTML
            editorRef.current.editor.innerHTML = "";
          }
        } catch {
          // Ignore editor clearing errors - state is already cleared
        }
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
    extractMentions,
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
      ref={containerRef}
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

      {/* Mention Autocomplete */}
      <MentionAutocomplete
        channelUuid={channelUuid}
        searchTerm={mentionState.searchTerm}
        position={mentionState.position}
        onSelect={handleMentionSelect}
        onClose={handleMentionClose}
        isVisible={mentionState.isVisible}
      />

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
            title="Mention someone (@)"
            type="button"
            onClick={handleMentionButtonClick}
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
