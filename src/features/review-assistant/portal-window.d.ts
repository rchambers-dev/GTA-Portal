export {};

declare global {
  var __PORTAL_REVIEW_NAVIGATE__: ((href: string) => void) | undefined;
  var __PORTAL_REVIEW_SESSION__: unknown;
  var __PORTAL_REVIEW_STAFF__: unknown;
  var __PORTAL_REVIEW_APPRENTICES__: unknown;
  var __PORTAL_REVIEW_FETCH__: boolean | undefined;
  var __REVIEW_APP_BOOTED: boolean | undefined;
  var __REVIEW_ROOT: HTMLDivElement | undefined;
  var __PORTAL_SET_REVIEW_PAGE__:
    | ((page: string, options?: { skipHash?: boolean }) => void)
    | undefined;
  var __PORTAL_OPEN_REVIEW_SETTINGS__: (() => void) | undefined;
  var __PORTAL_CLOSE_REVIEW_SETTINGS__: (() => void) | undefined;
}
