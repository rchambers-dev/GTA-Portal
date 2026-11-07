/**
 * The desktop rail expands for :hover and for :focus-within.
 * A mouse click focuses a category button, so the rail stayed open after the
 * pointer left. Keyboard activation uses a click whose detail is 0 and must
 * keep that focus. There is no separate pin control.
 */
export function pointerActivationRetainsFocus(detail: number): boolean {
  return detail <= 0;
}

/** A primary mouse press should not move focus onto the category button. */
export function shouldIgnorePointerFocus(pointerType: string, button: number): boolean {
  return pointerType === "mouse" && button === 0;
}
