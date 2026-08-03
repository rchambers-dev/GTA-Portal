import Link from "next/link";
import type { ChatAttachment, ChatMessage } from "../domain/chat/types";
import styles from "./ChatMessageBody.module.css";

function AttachmentBlock({
  attachment,
  mine,
}: {
  attachment: ChatAttachment;
  mine: boolean;
}) {
  if (attachment.type === "portal_link") {
    return (
      <Link
        href={attachment.href}
        className={mine ? styles.portalLinkMine : styles.portalLinkTheirs}
      >
        <span className={styles.portalLinkArea}>{attachment.area}</span>
        <strong>{attachment.title}</strong>
        <span className={styles.portalLinkDetail}>{attachment.detail}</span>
        <span className={styles.portalLinkCta}>{attachment.actionLabel} →</span>
      </Link>
    );
  }

  if (attachment.type === "gif") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className={styles.mediaLink}
      >
        {attachment.mp4Url ? (
          <video
            src={attachment.mp4Url}
            poster={attachment.previewUrl}
            className={styles.media}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attachment.previewUrl}
            alt={attachment.title}
            className={styles.media}
            loading="lazy"
            decoding="async"
          />
        )}
        <span className={styles.gifBadge}>GIF</span>
      </a>
    );
  }

  if (attachment.type === "image") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className={styles.mediaLink}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.name}
          className={styles.media}
          loading="lazy"
          decoding="async"
        />
      </a>
    );
  }

  if (attachment.type === "sticker") {
    return (
      <div className={styles.stickerWrap} role="img" aria-label={attachment.title}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.previewUrl}
          alt={attachment.title}
          className={styles.sticker}
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  if (attachment.type === "contact") {
    return (
      <div className={mine ? styles.fileMine : styles.fileTheirs}>
        <div className={styles.contactRow}>
          <span className={styles.contactAvatar} aria-hidden>
            {attachment.initials}
          </span>
          <span className={styles.contactMain}>
            <strong>{attachment.name}</strong>
            <span>
              {attachment.roleLabel}
              {attachment.organisation ? ` · ${attachment.organisation}` : ""}
            </span>
          </span>
        </div>
      </div>
    );
  }

  if (attachment.type === "poll") {
    return (
      <div className={mine ? styles.fileMine : styles.fileTheirs}>
        <span className={styles.cardKicker}>Poll</span>
        <strong>{attachment.question}</strong>
        <ul className={styles.pollOptions}>
          {attachment.options.map((option, index) => (
            <li key={`${option}-${index}`}>
              <span className={styles.pollDot} aria-hidden />
              {option}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (attachment.type === "event") {
    return (
      <div className={mine ? styles.fileMine : styles.fileTheirs}>
        <span className={styles.cardKicker}>Event</span>
        <strong>{attachment.title}</strong>
        <span>
          {attachment.when}
          {attachment.location ? ` · ${attachment.location}` : ""}
        </span>
      </div>
    );
  }

  return (
    <div className={mine ? styles.fileMine : styles.fileTheirs}>
      <strong>{attachment.name}</strong>
      <span>{attachment.sizeLabel}</span>
    </div>
  );
}

export function ChatMessageBody({
  message,
  mine,
}: {
  message: ChatMessage;
  mine: boolean;
}) {
  return (
    <div className={styles.body}>
      {message.attachment ? (
        <AttachmentBlock attachment={message.attachment} mine={mine} />
      ) : null}
      {message.body ? <p className={styles.text}>{message.body}</p> : null}
    </div>
  );
}
