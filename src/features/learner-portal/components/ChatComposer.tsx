"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  CHAT_EMOJI_CATEGORIES,
  CHAT_GIF_MOODS,
  CHAT_STICKER_MOODS,
  formatFileSize,
  searchChatGifs,
  searchChatStickers,
  searchEmojis,
  type ChatGifOption,
  type ChatStickerOption,
} from "../domain/chat/composer-assets";
import { searchShareablePortalLinks } from "../domain/chat/portal-links";
import type {
  ChatAttachment,
  ChatPortalLinkAttachment,
  ChatSendPayload,
} from "../domain/chat/types";
import {
  decodeShareClipboard,
  toChatPortalLink,
} from "../domain/portal-share/types";
import { useLearnerChat } from "./LearnerChatProvider";
import { GifGridTile } from "./GifGridTile";
import styles from "./ChatComposer.module.css";

type TrayTab = "emoji" | "gif" | "sticker";
type Shell = "tray" | "attach" | "link" | "contact" | "poll" | "event" | null;

type ContextMenuState = {
  x: number;
  y: number;
} | null;

type AttachMenuId =
  | "document"
  | "media"
  | "camera"
  | "audio"
  | "contact"
  | "poll"
  | "event"
  | "sticker";

const ATTACH_MENU: {
  id: AttachMenuId;
  icon: string;
  label: string;
  tone: string;
}[] = [
  { id: "document", icon: "📄", label: "Document", tone: "purple" },
  { id: "media", icon: "🖼️", label: "Photos & videos", tone: "blue" },
  { id: "camera", icon: "📷", label: "Camera", tone: "pink" },
  { id: "audio", icon: "🎧", label: "Audio", tone: "orange" },
  { id: "contact", icon: "👤", label: "Contact", tone: "sky" },
  { id: "poll", icon: "📊", label: "Poll", tone: "amber" },
  { id: "event", icon: "📅", label: "Event", tone: "red" },
  { id: "sticker", icon: "🪄", label: "New sticker", tone: "teal" },
];

export function ChatComposer({
  onSend,
  disabled = false,
  placeholder = "Type a message",
  compact = false,
}: {
  onSend: (payload: ChatSendPayload) => void;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [shell, setShell] = useState<Shell>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [trayTab, setTrayTab] = useState<TrayTab>("emoji");
  const [emojiCategory, setEmojiCategory] = useState(
    CHAT_EMOJI_CATEGORIES[0]?.id ?? "smileys",
  );
  const [gifMood, setGifMood] = useState(CHAT_GIF_MOODS[0]?.id ?? "trending");
  const [stickerMood, setStickerMood] = useState(
    CHAT_STICKER_MOODS[0]?.id ?? "trending",
  );
  const [emojiQuery, setEmojiQuery] = useState("");
  const [gifQuery, setGifQuery] = useState("");
  const [stickerQuery, setStickerQuery] = useState("");
  const [brokenGifIds, setBrokenGifIds] = useState<string[]>([]);
  const [brokenStickerIds, setBrokenStickerIds] = useState<string[]>([]);
  const [liveGifs, setLiveGifs] = useState<ChatGifOption[] | null>(null);
  const [liveStickers, setLiveStickers] = useState<ChatStickerOption[] | null>(
    null,
  );
  const [gifsLoading, setGifsLoading] = useState(false);
  const [stickersLoading, setStickersLoading] = useState(false);
  const [hoveredStickerId, setHoveredStickerId] = useState<string | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const rootRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const trayId = useId();
  const attachId = useId();
  const linkId = useId();
  const contextMenuId = useId();
  const { pendingShare, clearPendingShare, contacts } = useLearnerChat();
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [eventTitle, setEventTitle] = useState("");
  const [eventWhen, setEventWhen] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [prevPendingShare, setPrevPendingShare] =
    useState<ChatPortalLinkAttachment | null>(null);

  if (pendingShare !== prevPendingShare) {
    setPrevPendingShare(pendingShare);
    if (pendingShare) {
      setAttachment(pendingShare);
      clearPendingShare();
      setShell(null);
      setContextMenu(null);
    }
  }

  const activeMood = CHAT_GIF_MOODS.find((m) => m.id === gifMood) ?? null;
  const activeStickerMood =
    CHAT_STICKER_MOODS.find((m) => m.id === stickerMood) ?? null;
  const emojis = searchEmojis(emojiQuery, emojiCategory);
  const gifTabOpen = shell === "tray" && trayTab === "gif";
  const stickerTabOpen = shell === "tray" && trayTab === "sticker";
  // Live GIPHY results when the API is configured; curated catalog otherwise.
  const gifs = (
    liveGifs ?? searchChatGifs(gifQuery, activeMood?.tag ?? null)
  ).filter((gif) => !brokenGifIds.includes(gif.id));
  const stickers = (
    liveStickers ??
    searchChatStickers(stickerQuery, activeStickerMood?.tag ?? null)
  ).filter((sticker) => !brokenStickerIds.includes(sticker.id));

  useEffect(() => {
    if (!gifTabOpen) return;
    const term = gifQuery.trim() || (activeMood?.searchTerm ?? "");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setGifsLoading(true);
      try {
        const response = await fetch(
          `/api/gifs?type=gifs&q=${encodeURIComponent(term)}&limit=24`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`GIF API ${response.status}`);
        const payload = (await response.json()) as {
          configured: boolean;
          items?: {
            id: string;
            title: string;
            url: string;
            previewUrl: string;
            stillUrl?: string;
            mp4Url?: string;
          }[];
          gifs?: {
            id: string;
            title: string;
            url: string;
            previewUrl: string;
            stillUrl?: string;
            mp4Url?: string;
          }[];
        };
        if (!payload.configured) {
          setLiveGifs(null);
          return;
        }
        const items = payload.items ?? payload.gifs ?? [];
        setLiveGifs(
          items.map((gif) => ({
            ...gif,
            type: "gif" as const,
            tags: [],
          })),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLiveGifs(null);
      } finally {
        if (!controller.signal.aborted) setGifsLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [gifTabOpen, gifQuery, activeMood?.searchTerm]);

  useEffect(() => {
    if (!stickerTabOpen) return;
    const term =
      stickerQuery.trim() || (activeStickerMood?.searchTerm ?? "");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStickersLoading(true);
      try {
        const response = await fetch(
          `/api/gifs?type=stickers&q=${encodeURIComponent(term)}&limit=24`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error(`Sticker API ${response.status}`);
        const payload = (await response.json()) as {
          configured: boolean;
          items?: ChatStickerOption[];
        };
        if (!payload.configured) {
          setLiveStickers(null);
          return;
        }
        setLiveStickers(
          (payload.items ?? []).map((sticker) => ({
            ...sticker,
            tags: sticker.tags ?? [],
          })),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLiveStickers(null);
      } finally {
        if (!controller.signal.aborted) setStickersLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [stickerTabOpen, stickerQuery, activeStickerMood?.searchTerm]);

  const portalLinks = searchShareablePortalLinks(linkQuery);
  const activeEmojiCategory =
    CHAT_EMOJI_CATEGORIES.find((c) => c.id === emojiCategory) ??
    CHAT_EMOJI_CATEGORIES[0];

  useEffect(() => {
    if (!shell && !contextMenu) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current) return;
      const target = event.target as Node | null;
      if (!target) return;
      // Keep open when interacting with the composer, picker, or attach menus.
      if (rootRef.current.contains(target)) return;
      setShell(null);
      setContextMenu(null);
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setContextMenu(null);
        setShell(null);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [shell, contextMenu]);

  function openContextMenu(event: ReactMouseEvent) {
    event.preventDefault();
    const root = rootRef.current?.getBoundingClientRect();
    if (!root) return;
    setShell(null);
    setContextMenu({
      x: Math.min(Math.max(8, event.clientX - root.left), root.width - 180),
      y: Math.max(8, event.clientY - root.top - 8),
    });
  }

  function openLinkPicker() {
    setContextMenu(null);
    setLinkQuery("");
    setShell("link");
  }

  function pickFile(accept?: string, capture?: boolean) {
    const el = fileRef.current;
    if (!el) return;
    if (accept) el.setAttribute("accept", accept);
    else el.removeAttribute("accept");
    if (capture) el.setAttribute("capture", "environment");
    else el.removeAttribute("capture");
    setShell(null);
    el.click();
  }

  function handleAttachOption(id: AttachMenuId) {
    switch (id) {
      case "document":
        pickFile(
          ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip",
        );
        break;
      case "media":
        pickFile("image/*,video/*");
        break;
      case "camera":
        pickFile("image/*", true);
        break;
      case "audio":
        pickFile("audio/*");
        break;
      case "contact":
        setShell("contact");
        break;
      case "poll":
        setPollQuestion("");
        setPollOptions(["", ""]);
        setShell("poll");
        break;
      case "event":
        setEventTitle("");
        setEventWhen("");
        setEventLocation("");
        setShell("event");
        break;
      case "sticker":
        setTrayTab("sticker");
        setShell("tray");
        break;
    }
  }

  function attachPoll() {
    const question = pollQuestion.trim();
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!question || options.length < 2) return;
    setAttachment({ type: "poll", question, options });
    setShell(null);
  }

  function attachEvent() {
    const title = eventTitle.trim();
    if (!title || !eventWhen) return;
    const when = new Date(eventWhen).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    setAttachment({
      type: "event",
      title,
      when,
      location: eventLocation.trim() || undefined,
    });
    setShell(null);
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setDraft((current) => `${current}${emoji}`);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + emoji.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  function clearAttachment() {
    if (attachment?.type === "image" && attachment.url.startsWith("blob:")) {
      URL.revokeObjectURL(attachment.url);
    }
    setAttachment(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      if (attachment?.type === "image" && attachment.url.startsWith("blob:")) {
        URL.revokeObjectURL(attachment.url);
      }
      setAttachment({ type: "image", url, name: file.name });
      setShell(null);
      return;
    }

    setAttachment({
      type: "file",
      name: file.name,
      sizeLabel: formatFileSize(file.size),
    });
    setShell(null);
  }

  function submit() {
    const body = draft.trim();
    if (disabled || (!body && !attachment)) return;
    onSend({
      body,
      ...(attachment ? { attachment } : {}),
    });
    setDraft("");
    clearAttachment();
    setShell(null);
    setContextMenu(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const text = event.clipboardData.getData("text/plain");
    const share = decodeShareClipboard(text);
    if (!share) return;
    event.preventDefault();
    setAttachment(toChatPortalLink(share));
    setShell(null);
    setContextMenu(null);
  }

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, compact ? 88 : 120)}px`;
  }

  const canSend = Boolean(draft.trim() || attachment) && !disabled;

  return (
    <form
      ref={rootRef}
      className={compact ? `${styles.root} ${styles.compact}` : styles.root}
      onSubmit={handleSubmit}
    >
      {attachment ? (
        <div className={styles.preview}>
          {attachment.type === "gif" && attachment.mp4Url ? (
            <video
              src={attachment.mp4Url}
              poster={attachment.previewUrl}
              className={styles.previewMedia}
              muted
              loop
              playsInline
              autoPlay
            />
          ) : attachment.type === "gif" || attachment.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                attachment.type === "gif"
                  ? attachment.previewUrl
                  : attachment.url
              }
              alt={
                attachment.type === "gif" ? attachment.title : attachment.name
              }
              className={styles.previewMedia}
            />
          ) : attachment.type === "portal_link" ? (
            <div className={styles.previewLink}>
              <span className={styles.previewLinkArea}>{attachment.area}</span>
              <strong>{attachment.title}</strong>
              <span>{attachment.detail}</span>
            </div>
          ) : attachment.type === "contact" ? (
            <div className={styles.previewLink}>
              <span className={styles.previewLinkArea}>Contact</span>
              <strong>{attachment.name}</strong>
              <span>
                {attachment.roleLabel}
                {attachment.organisation ? ` · ${attachment.organisation}` : ""}
              </span>
            </div>
          ) : attachment.type === "poll" ? (
            <div className={styles.previewLink}>
              <span className={styles.previewLinkArea}>Poll</span>
              <strong>{attachment.question}</strong>
              <span>{attachment.options.length} options</span>
            </div>
          ) : attachment.type === "event" ? (
            <div className={styles.previewLink}>
              <span className={styles.previewLinkArea}>Event</span>
              <strong>{attachment.title}</strong>
              <span>
                {attachment.when}
                {attachment.location ? ` · ${attachment.location}` : ""}
              </span>
            </div>
          ) : attachment.type === "sticker" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={attachment.previewUrl}
              alt={attachment.title}
              className={styles.previewSticker}
            />
          ) : (
            <div className={styles.previewFile}>
              <strong>{attachment.name}</strong>
              <span>{attachment.sizeLabel}</span>
            </div>
          )}
          <button
            type="button"
            className={styles.previewRemove}
            onClick={clearAttachment}
            aria-label="Remove attachment"
          >
            ×
          </button>
        </div>
      ) : null}

      {shell === "tray" ? (
        <div className={styles.tray} id={trayId} role="dialog" aria-label="Emoji and GIF picker">
          <div className={styles.trayBody}>
            {trayTab === "emoji" ? (
              <>
                <div className={styles.categoryRow} role="tablist" aria-label="Emoji categories">
                  {CHAT_EMOJI_CATEGORIES.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      role="tab"
                      aria-selected={emojiCategory === category.id}
                      className={
                        emojiCategory === category.id
                          ? styles.categoryActive
                          : styles.categoryBtn
                      }
                      onClick={() => setEmojiCategory(category.id)}
                      title={category.label}
                    >
                      <span aria-hidden>{category.icon}</span>
                    </button>
                  ))}
                </div>
                <label className={styles.searchWrap}>
                  <span className={styles.searchIcon} aria-hidden>
                    ⌕
                  </span>
                  <input
                    value={emojiQuery}
                    onChange={(event) => setEmojiQuery(event.target.value)}
                    placeholder="Search emoji"
                    aria-label="Search emoji"
                  />
                </label>
                <p className={styles.sectionLabel}>
                  {activeEmojiCategory?.label ?? "Emojis"}
                </p>
                <div className={styles.emojiGrid}>
                  {emojis.map((emoji, index) => (
                    <button
                      key={`${emoji}-${index}`}
                      type="button"
                      className={styles.emojiBtn}
                      onClick={() => insertEmoji(emoji)}
                      aria-label={`Insert ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {trayTab === "gif" ? (
              <>
                <div className={styles.categoryRow} role="tablist" aria-label="GIF moods">
                  {CHAT_GIF_MOODS.map((mood) => (
                    <button
                      key={mood.id}
                      type="button"
                      role="tab"
                      aria-selected={gifMood === mood.id}
                      className={
                        gifMood === mood.id
                          ? styles.categoryActive
                          : styles.categoryBtn
                      }
                      onClick={() => setGifMood(mood.id)}
                      title={mood.label}
                    >
                      <span aria-hidden>{mood.icon}</span>
                    </button>
                  ))}
                </div>
                <label className={styles.searchWrap}>
                  <span className={styles.searchIcon} aria-hidden>
                    ⌕
                  </span>
                  <input
                    value={gifQuery}
                    onChange={(event) => setGifQuery(event.target.value)}
                    placeholder="Search GIFs via GIPHY"
                    aria-label="Search GIFs"
                  />
                </label>
                <div className={styles.gifGrid}>
                  {gifs.length === 0 ? (
                    <p className={styles.empty}>
                      {gifsLoading
                        ? "Loading GIFs…"
                        : "No GIFs match that search."}
                    </p>
                  ) : (
                    gifs.map((gif) => (
                      <GifGridTile
                        key={gif.id}
                        gif={gif}
                        onSelect={() => {
                          setAttachment({
                            type: "gif",
                            url: gif.url,
                            previewUrl: gif.previewUrl,
                            title: gif.title,
                            ...(gif.mp4Url ? { mp4Url: gif.mp4Url } : {}),
                          });
                          setShell(null);
                        }}
                        onBroken={() => {
                          setBrokenGifIds((prev) =>
                            prev.includes(gif.id) ? prev : [...prev, gif.id],
                          );
                        }}
                      />
                    ))
                  )}
                </div>
              </>
            ) : null}

            {trayTab === "sticker" ? (
              <>
                <div
                  className={styles.categoryRow}
                  role="tablist"
                  aria-label="Sticker moods"
                >
                  {CHAT_STICKER_MOODS.map((mood) => (
                    <button
                      key={mood.id}
                      type="button"
                      role="tab"
                      aria-selected={stickerMood === mood.id}
                      className={
                        stickerMood === mood.id
                          ? styles.categoryActive
                          : styles.categoryBtn
                      }
                      onClick={() => setStickerMood(mood.id)}
                      title={mood.label}
                    >
                      <span aria-hidden>{mood.icon}</span>
                    </button>
                  ))}
                </div>
                <label className={styles.searchWrap}>
                  <span className={styles.searchIcon} aria-hidden>
                    ⌕
                  </span>
                  <input
                    value={stickerQuery}
                    onChange={(event) => setStickerQuery(event.target.value)}
                    placeholder="Search stickers via GIPHY"
                    aria-label="Search stickers"
                  />
                </label>
                <div className={styles.stickerGrid}>
                  {stickers.length === 0 ? (
                    <p className={styles.empty}>
                      {stickersLoading
                        ? "Loading stickers…"
                        : "No stickers match that search."}
                    </p>
                  ) : (
                    stickers.map((sticker) => (
                      <button
                        key={sticker.id}
                        type="button"
                        className={styles.stickerBtn}
                        onClick={() => {
                          if (disabled) return;
                          onSend({
                            attachment: {
                              type: "sticker",
                              url: sticker.url,
                              previewUrl: sticker.previewUrl,
                              title: sticker.title,
                            },
                          });
                          setShell(null);
                        }}
                        onMouseEnter={() => setHoveredStickerId(sticker.id)}
                        onMouseLeave={() => setHoveredStickerId(null)}
                        onFocus={() => setHoveredStickerId(sticker.id)}
                        onBlur={() => setHoveredStickerId(null)}
                        aria-label={`Send sticker: ${sticker.title}`}
                        title={sticker.title}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            hoveredStickerId === sticker.id
                              ? sticker.previewUrl
                              : (sticker.stillUrl ?? sticker.previewUrl)
                          }
                          alt=""
                          loading="lazy"
                          decoding="async"
                          onError={() => {
                            setBrokenStickerIds((prev) =>
                              prev.includes(sticker.id)
                                ? prev
                                : [...prev, sticker.id],
                            );
                          }}
                        />
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : null}
          </div>

          <div className={styles.trayFooter}>
            <div className={styles.modeSwitch} role="tablist" aria-label="Picker mode">
              <button
                type="button"
                role="tab"
                aria-selected={trayTab === "emoji"}
                className={
                  trayTab === "emoji" ? styles.modeActive : styles.modeBtn
                }
                onClick={() => setTrayTab("emoji")}
                aria-label="Emojis"
              >
                😊
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={trayTab === "gif"}
                className={
                  trayTab === "gif" ? styles.modeActive : styles.modeBtn
                }
                onClick={() => setTrayTab("gif")}
              >
                GIF
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={trayTab === "sticker"}
                className={
                  trayTab === "sticker" ? styles.modeActive : styles.modeBtn
                }
                onClick={() => setTrayTab("sticker")}
                aria-label="Stickers"
              >
                🏷️
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shell === "attach" ? (
        <div
          className={styles.attachSheet}
          id={attachId}
          role="menu"
          aria-label="Attach"
        >
          {ATTACH_MENU.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitem"
              className={styles.attachOption}
              onClick={() => handleAttachOption(option.id)}
            >
              <span className={styles.attachIcon} data-tone={option.tone}>
                {option.icon}
              </span>
              <span className={styles.attachLabel}>{option.label}</span>
            </button>
          ))}
          <p className={styles.attachHint}>
            Tip: right-click the message box to share a portal link.
          </p>
        </div>
      ) : null}

      {shell === "contact" ? (
        <div
          className={styles.linkSheet}
          role="dialog"
          aria-label="Share a contact"
        >
          <div className={styles.linkSheetHead}>
            <strong>Share contact</strong>
            <button
              type="button"
              className={styles.linkClose}
              onClick={() => setShell(null)}
              aria-label="Close contact picker"
            >
              ×
            </button>
          </div>
          <div className={styles.linkList}>
            {contacts.map((contact) => (
              <button
                key={contact.contactId}
                type="button"
                className={styles.linkBtn}
                onClick={() => {
                  setAttachment({
                    type: "contact",
                    name: contact.name,
                    initials: contact.initials,
                    roleLabel: contact.roleLabel,
                    organisation: contact.organisation,
                  });
                  setShell(null);
                }}
              >
                <strong>{contact.name}</strong>
                <span>
                  {contact.roleLabel}
                  {contact.organisation ? ` · ${contact.organisation}` : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {shell === "poll" ? (
        <div
          className={styles.linkSheet}
          role="dialog"
          aria-label="Create a poll"
        >
          <div className={styles.linkSheetHead}>
            <strong>Create poll</strong>
            <button
              type="button"
              className={styles.linkClose}
              onClick={() => setShell(null)}
              aria-label="Close poll builder"
            >
              ×
            </button>
          </div>
          <div className={styles.builderForm}>
            <input
              className={styles.builderInput}
              value={pollQuestion}
              onChange={(event) => setPollQuestion(event.target.value)}
              placeholder="Ask a question"
              aria-label="Poll question"
              autoFocus
            />
            {pollOptions.map((option, index) => (
              <input
                key={index}
                className={styles.builderInput}
                value={option}
                onChange={(event) =>
                  setPollOptions((current) =>
                    current.map((o, i) =>
                      i === index ? event.target.value : o,
                    ),
                  )
                }
                placeholder={`Option ${index + 1}`}
                aria-label={`Poll option ${index + 1}`}
              />
            ))}
            {pollOptions.length < 5 ? (
              <button
                type="button"
                className={styles.builderGhost}
                onClick={() => setPollOptions((current) => [...current, ""])}
              >
                + Add option
              </button>
            ) : null}
            <button
              type="button"
              className={styles.builderBtn}
              disabled={
                !pollQuestion.trim() ||
                pollOptions.filter((o) => o.trim()).length < 2
              }
              onClick={attachPoll}
            >
              Attach poll
            </button>
          </div>
        </div>
      ) : null}

      {shell === "event" ? (
        <div
          className={styles.linkSheet}
          role="dialog"
          aria-label="Create an event"
        >
          <div className={styles.linkSheetHead}>
            <strong>Create event</strong>
            <button
              type="button"
              className={styles.linkClose}
              onClick={() => setShell(null)}
              aria-label="Close event builder"
            >
              ×
            </button>
          </div>
          <div className={styles.builderForm}>
            <input
              className={styles.builderInput}
              value={eventTitle}
              onChange={(event) => setEventTitle(event.target.value)}
              placeholder="Event name"
              aria-label="Event name"
              autoFocus
            />
            <input
              className={styles.builderInput}
              type="datetime-local"
              value={eventWhen}
              onChange={(event) => setEventWhen(event.target.value)}
              aria-label="Event date and time"
            />
            <input
              className={styles.builderInput}
              value={eventLocation}
              onChange={(event) => setEventLocation(event.target.value)}
              placeholder="Location (optional)"
              aria-label="Event location"
            />
            <button
              type="button"
              className={styles.builderBtn}
              disabled={!eventTitle.trim() || !eventWhen}
              onClick={attachEvent}
            >
              Attach event
            </button>
          </div>
        </div>
      ) : null}

      {shell === "link" ? (
        <div
          className={styles.linkSheet}
          id={linkId}
          role="dialog"
          aria-label="Share a portal link"
        >
          <div className={styles.linkSheetHead}>
            <strong>Share portal link</strong>
            <button
              type="button"
              className={styles.linkClose}
              onClick={() => setShell(null)}
              aria-label="Close link picker"
            >
              ×
            </button>
          </div>
          <p className={styles.linkIntro}>
            Pick something staff can open straight away to approve, deny, or
            complete.
          </p>
          <input
            className={styles.linkSearch}
            value={linkQuery}
            onChange={(event) => setLinkQuery(event.target.value)}
            placeholder="Search OTJ, CEA, approvals…"
            aria-label="Search portal links"
            autoFocus
          />
          <div className={styles.linkList}>
            {portalLinks.length === 0 ? (
              <p className={styles.empty}>No matching portal links.</p>
            ) : (
              portalLinks.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => {
                    setAttachment({
                      type: "portal_link",
                      href: link.href,
                      title: link.title,
                      detail: link.detail,
                      actionLabel: link.actionLabel,
                      area: link.area,
                    });
                    setShell(null);
                  }}
                >
                  <span className={styles.linkBtnArea}>{link.area}</span>
                  <strong>{link.title}</strong>
                  <span>{link.detail}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {contextMenu ? (
        <div
          className={styles.contextMenu}
          id={contextMenuId}
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            className={styles.contextItem}
            onClick={openLinkPicker}
          >
            Share portal link…
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.contextItem}
            onClick={() => {
              setContextMenu(null);
              fileRef.current?.click();
            }}
          >
            Attach photo or file…
          </button>
        </div>
      ) : null}

      <div className={styles.composerRow}>
        <div className={styles.pill} onContextMenu={openContextMenu}>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Attach"
            aria-expanded={shell === "attach"}
            aria-controls={attachId}
            onClick={() => {
              setContextMenu(null);
              setShell((current) => (current === "attach" ? null : "attach"));
            }}
          >
            <span aria-hidden>+</span>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            aria-label="Emoji, GIF and stickers"
            aria-expanded={shell === "tray"}
            aria-controls={trayId}
            onClick={() => {
              setContextMenu(null);
              setShell((current) => (current === "tray" ? null : "tray"));
            }}
          >
            <span aria-hidden>😊</span>
          </button>
          <textarea
            ref={textareaRef}
            className={styles.input}
            value={draft}
            rows={1}
            placeholder={placeholder}
            aria-label="Message"
            disabled={disabled}
            onChange={(event) => {
              setDraft(event.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onContextMenu={openContextMenu}
            onFocus={() => {
              setContextMenu(null);
              if (shell === "attach") setShell(null);
            }}
          />
        </div>
        <button
          type="submit"
          className={styles.sendFab}
          disabled={!canSend}
          aria-label="Send message"
        >
          <span aria-hidden>➤</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        className={styles.fileInput}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
      />
    </form>
  );
}
